# -*- coding: utf-8 -*-
"""Bancos e cooperativas da planilha de instituições financeiras (Gupy).

Lê as páginas públicas de carreira na Gupy listadas em data/bancos_csv.json
e faz buscas extras no MCP público de candidatos da Gupy pelos cargos de
gestão bancária. Fica separado da fonte "gupy" para que uma falha aqui não
afete a coleta principal; vagas repetidas são unidas pelo pipeline.
"""
import json
import time
from pathlib import Path

from . import gupy

SOURCE = "bancos_csv"
CONFIG = Path(__file__).resolve().parent.parent / "data" / "bancos_csv.json"
PAGE_DELAY_SECONDS = 0.5


def _config():
    with open(CONFIG, encoding="utf-8") as handle:
        return json.load(handle)


def _relabel(row):
    row = dict(row)
    row["source"] = SOURCE
    return row


def fetch():
    config = _config()
    unique, failures, attempts = {}, [], 0

    for page_url in config.get("gupy_paginas") or []:
        attempts += 1
        try:
            rows = gupy._career_page_rows(page_url)
        except Exception as error:  # uma página fora do ar não derruba as outras
            failures.append(page_url)
            print(f"    [bancos_csv] {page_url} indisponível: {str(error)[:100]}")
            continue
        for row in rows:
            unique[str(row.get("native_id") or row.get("url"))] = _relabel(row)
        time.sleep(PAGE_DELAY_SECONDS)

    terms = config.get("gupy_buscas") or []
    if terms:
        attempts += 1
        client = gupy.GupyMCPClient()
        try:
            client.connect()
            for term in terms:
                try:
                    rows = gupy._fetch_term(term, client)
                except Exception as error:
                    print(f"    [bancos_csv] busca '{term}' falhou: {str(error)[:100]}")
                    continue
                for row in rows:
                    key = str(row.get("native_id") or row.get("url"))
                    unique.setdefault(key, _relabel(row))
        except Exception as error:
            failures.append("gupy-mcp")
            print(f"    [bancos_csv] MCP da Gupy indisponível: {str(error)[:100]}")
        finally:
            try:
                client.close()
            except Exception:
                pass

    if attempts and len(failures) == attempts:
        raise RuntimeError("todas as páginas de bancos_csv falharam")
    print(f"    [bancos_csv] {len(unique)} vagas; {len(failures)} página(s) com falha")
    return list(unique.values())
