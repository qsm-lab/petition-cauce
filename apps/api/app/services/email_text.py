"""Versión en texto plano de los correos HTML (entregabilidad).

Un correo solo con HTML suma puntos de spam en Outlook y otros filtros; el transporte envía las dos partes.
Conversión mínima con la biblioteca estándar: bloques → saltos de línea, enlaces → «texto (url)», sin `head`/`style`.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

_BLOCK = {"p", "div", "tr", "table", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "td", "hr"}
_SKIP = {"head", "style", "script", "title"}


class _TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._skip = 0
        self._href: str | None = None
        self._link_text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP:
            self._skip += 1
        elif tag == "br":
            self._emit("\n")
        elif tag in _BLOCK:
            self._emit("\n")
        elif tag == "a":
            self._href = dict(attrs).get("href") or None
            self._link_text = []

    def handle_endtag(self, tag):
        if tag in _SKIP:
            self._skip = max(0, self._skip - 1)
        elif tag in _BLOCK:
            self._emit("\n")
        elif tag == "a" and self._href is not None:
            href, label = self._href, " ".join("".join(self._link_text).split())
            self._href = None
            if href.startswith("mailto:") and label:
                self._emit(label)
            elif label and label != href:
                self._emit(f"{label} ({href})")
            else:
                self._emit(href)

    def handle_data(self, data):
        if self._skip:
            return
        if self._href is not None:
            self._link_text.append(data)
        else:
            self._emit(data)

    def _emit(self, s: str) -> None:
        self.out.append(s)


def html_to_text(html: str) -> str:
    p = _TextParser()
    p.feed(html)
    p.close()
    raw = "".join(p.out)
    lines = [" ".join(line.split()) for line in raw.split("\n")]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()
