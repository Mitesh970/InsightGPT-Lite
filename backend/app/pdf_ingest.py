from pathlib import Path

import fitz

from app.utils import normalize_text


def extract_pdf_pages(path: Path) -> list[dict]:
    pages: list[dict] = []

    with fitz.open(path) as doc:
        for page_index, page in enumerate(doc, start=1):
            blocks = page.get_text("dict").get("blocks", [])
            markdown_parts: list[str] = []

            for block in blocks:
                if block.get("type") != 0:
                    continue

                block_lines: list[str] = []
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    line_text = " ".join(span.get("text", "") for span in spans).strip()
                    if not line_text:
                        continue

                    max_size = max((span.get("size", 0) for span in spans), default=0)
                    if max_size >= 16 and len(line_text) < 140:
                        line_text = f"## {line_text}"

                    block_lines.append(line_text)

                if block_lines:
                    markdown_parts.append("\n".join(block_lines))

            content = normalize_text("\n\n".join(markdown_parts))
            if content:
                pages.append(
                    {
                        "page_number": page_index,
                        "markdown": content,
                        "html": "<article>" + content.replace("\n\n", "</p><p>").replace("\n", "<br>") + "</article>",
                    }
                )

    return pages

