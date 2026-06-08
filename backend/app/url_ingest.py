from bs4 import BeautifulSoup
from markdownify import markdownify as html_to_markdown
from playwright.async_api import async_playwright

from app.utils import normalize_text


async def scrape_url(url: str) -> dict:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle", timeout=30000)
        title = await page.title()
        html = await page.content()
        await browser.close()

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "nav", "footer"]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.body or soup
    clean_html = str(main)
    markdown = normalize_text(html_to_markdown(clean_html, heading_style="ATX"))

    return {
        "title": normalize_text(title) or url,
        "html": clean_html,
        "markdown": markdown,
    }

