from fastapi import FastAPI, Request
from pydantic import BaseModel
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import urllib.parse
import asyncio

app = FastAPI(title="Custom Lead Scraper API")

class SearchQuery(BaseModel):
    q: str

async def auto_scroll(page):
    """Rola a página para carregar todos os resultados no Maps."""
    await page.evaluate("""
        async () => {
            await new Promise((resolve, reject) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollable = document.querySelector('div[role="feed"]');
                    if (scrollable) {
                        scrollable.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= 3000){ // Limite de scroll
                            clearInterval(timer);
                            resolve();
                        }
                    } else {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= 3000){
                            clearInterval(timer);
                            resolve();
                        }
                    }
                }, 100);
            });
        }
    """)

@app.post("/search")
async def google_search(query: SearchQuery):
    """Substitui o endpoint https://google.serper.dev/search"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        url = f"https://www.google.com/search?q={urllib.parse.quote(query.q)}"
        await page.goto(url)
        await asyncio.sleep(2) # Aguarda carregamento humano
        
        html = await page.content()
        await browser.close()
        
        soup = BeautifulSoup(html, 'html.parser')
        results = []
        
        # Extrai os resultados orgânicos da div com classe 'g'
        for g in soup.find_all('div', class_='g'):
            title_element = g.find('h3')
            link_element = g.find('a', href=True)
            
            if title_element and link_element:
                # Tenta pegar o snippet (resumo)
                snippet_text = ""
                snippet_div = g.find('div', style=lambda value: value and '-webkit-line-clamp' in value)
                if snippet_div:
                    snippet_text = snippet_div.text
                else:
                    snippet_text = g.text.replace(title_element.text, '')[:200]
                
                results.append({
                    "title": title_element.text,
                    "link": link_element['href'],
                    "snippet": snippet_text
                })
                
        return {"organic": results}

@app.post("/maps")
async def google_maps(query: SearchQuery):
    """Substitui o endpoint https://google.serper.dev/maps"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        url = f"https://www.google.com/maps/search/{urllib.parse.quote(query.q)}"
        await page.goto(url)
        
        # Espera o feed de resultados carregar
        try:
            await page.wait_for_selector('a.hfpxzc', timeout=5000)
            await auto_scroll(page)
        except:
            pass # Continua mesmo se não achar logo de cara
            
        html = await page.content()
        await browser.close()
        
        soup = BeautifulSoup(html, 'html.parser')
        places = []
        
        # Extrai os estabelecimentos no Maps
        for a_tag in soup.find_all('a', class_='hfpxzc'):
            title = a_tag.get('aria-label', '')
            link = a_tag.get('href', '')
            
            if title and link:
                places.append({
                    "title": title,
                    "link": link,
                    "address": "", # O Maps obscurece muito o DOM, deixamos vazio pois o n8n vai raspar o "link" (fonte_url) em seguida
                })
                
        return {"places": places}

if __name__ == "__main__":
    import uvicorn
    # Roda o servidor na porta 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
