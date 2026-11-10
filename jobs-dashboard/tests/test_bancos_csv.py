# -*- coding: utf-8 -*-
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sources import bancos_csv  # noqa: E402


class FakeClient:
    def connect(self):
        pass

    def close(self):
        pass


class BancosCsvTest(unittest.TestCase):
    config = {"gupy_paginas": ["https://a.gupy.io/", "https://b.gupy.io/"], "gupy_buscas": ["gerente regional"]}

    def test_uma_pagina_fora_do_ar_nao_derruba_as_outras(self):
        def page(url):
            if "a.gupy" in url:
                raise RuntimeError("fora do ar")
            return [{"source": "gupy", "native_id": "1", "title": "Gerente de Agência", "url": "u1"}]

        with mock.patch.object(bancos_csv, "_config", return_value=self.config), \
                mock.patch.object(bancos_csv.gupy, "_career_page_rows", side_effect=page), \
                mock.patch.object(bancos_csv.gupy, "GupyMCPClient", FakeClient), \
                mock.patch.object(bancos_csv.gupy, "_fetch_term",
                                  return_value=[{"source": "gupy", "native_id": "2", "title": "Gerente Regional", "url": "u2"}]), \
                mock.patch.object(bancos_csv, "PAGE_DELAY_SECONDS", 0):
            rows = bancos_csv.fetch()
        self.assertEqual({r["native_id"] for r in rows}, {"1", "2"})
        self.assertTrue(all(r["source"] == "bancos_csv" for r in rows))

    def test_tudo_fora_do_ar_marca_falha(self):
        with mock.patch.object(bancos_csv, "_config", return_value={"gupy_paginas": ["https://a.gupy.io/"]}), \
                mock.patch.object(bancos_csv.gupy, "_career_page_rows", side_effect=RuntimeError("x")), \
                mock.patch.object(bancos_csv, "PAGE_DELAY_SECONDS", 0):
            with self.assertRaises(RuntimeError):
                bancos_csv.fetch()


if __name__ == "__main__":
    unittest.main()
