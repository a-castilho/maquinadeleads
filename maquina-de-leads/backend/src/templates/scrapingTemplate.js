/**
 * Gera o JSON do workflow n8n de RASPAGEM (scraping) completo e corrigido.
 */
function buildScrapingWorkflow(config) {
  const {
    nicheId,
    nicheName,
    keywords = [],
    contextTerms = ["whatsapp", "contato", "telefone", "wa.me"],
    serperApiKey,
    searxngUrl = "http://searxng:8080/search",
    postgresCredentialId,
    scheduleHours = 6,
  } = config;

  const keywordsEscaped = JSON.stringify(keywords);
  const contextTermsEscaped = JSON.stringify(contextTerms);

  // 1. Gera Queries de Busca
  const geraQueriesCode = [
    'const keywords = ' + keywordsEscaped + ';',
    'const contextTerms = ' + contextTermsEscaped + ';',
    'const sites = ["site:instagram.com", "site:facebook.com", "site:linktr.ee", "site:tiktok.com"];',
    'const NICHE_ID = "' + nicheId + '";',
    '',
    'const queries = [];',
    'for (const kw of keywords) {',
    "  const cleanKw = String(kw).replace(/^[\"']+|[\"']+$/g, '');",
    "  if (!cleanKw) continue;",
    '  for (const site of sites) {',
    '    for (const ctx of contextTerms) {',
    '      const siteQuery = site ? " " + site : "";',
    '      queries.push({',
    '        q: \'"\' + cleanKw + \'" \' + ctx + siteQuery,',
    '        niche_id: NICHE_ID',
    '      });',
    '    }',
    '  }',
    '}',
    'return queries.slice(0, 50).map(q => ({ json: q }));'
  ].join('\n');

  // 2. Extrai e Formata Leads do Snippet
  const extraiLeadsCode = [
    'const dddsValidos = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);',
    'const blacklistDomains = ["amazon.", "microsoft.", "youtube.com", "cinemark.", "thehill.com", "google."];',
    'const blacklistTitle = ["link to", "quanto custa", "como colocar", "grupo", "festas em", "tudo para", "olx", "professor", "quarteirão", "playlist", "oferta", "dicas", "como ativar"];',
    '',
    'function extrairWhatsapp(texto) {',
    '  if (!texto) return null;',
    '  const str = String(texto);',
    '  const matchWaUrl = str.match(/(?:wa\\.me\\/|phone=|whatsapp\\.com\\/send\\?phone=|api\\.whatsapp\\.com\\/send\\?phone=)(\\d{10,13})/i);',
    '  if (matchWaUrl) {',
    '    let num = matchWaUrl[1].replace(/\\D/g, "");',
    '    if (num.length === 11) num = "55" + num;',
    '    if (num.length === 13 && num.startsWith("55")) return num;',
    '  }',
    '  const regex = /(?:\\+?55\\s*)?(?:\\(?([1-9]{2})\\)?\\s*)(?:9\\s*\\d{4}|\\d{4})[\\s.-]?\\d{4}/g;',
    '  const matches = str.match(regex) || [];',
    '  for (const m of matches) {',
    '    const digitos = m.replace(/\\D/g, "");',
    '    let numCompleto = digitos.length === 11 ? "55" + digitos : digitos;',
    '    if (numCompleto.length === 13 && numCompleto.startsWith("55")) {',
    '      const ddd = parseInt(numCompleto.substring(2, 4), 10);',
    '      if (dddsValidos.has(ddd) && numCompleto[4] === "9") return numCompleto;',
    '    }',
    '  }',
    '  return null;',
    '}',
    '',
    'function extrairWaUsername(url) {',
    '  if (!url) return null;',
    '  const match = url.match(/(?:wa\\.me\\/|phone=)(\\d{10,15})/i);',
    '  return match ? match[1] : null;',
    '}',
    '',
    'function limparNomePerfil(title) {',
    '  if (!title) return "Desconhecido";',
    '  let nome = title.replace(/• Instagram photos and videos/gi, "").replace(/Instagram/gi, "").replace(/в Instagram : Link to instagram\\.com/gi, "").replace(/Link to (instagram|facebook)\\.com/gi, "").split("|")[0].split("-")[0].split("(")[0].trim();',
    '  return nome.length > 2 ? nome : "Desconhecido";',
    '}',
    '',
    'const allItems = $input.all();',
    'const items = [];',
    'const seenUrls = new Set();',
    '',
    'for (const item of allItems) {',
    '  const res = item.json || {};',
    '  if (res.error) continue;',
    '  const currentQuery = res.query || res.searchParameters?.q || res.q || "";',
    "  const nicheId = res.niche_id || '" + nicheId + "';",
    '  const resultsList = [];',
    '  const rawResults = res.results || res.organic || [];',
    '  if (Array.isArray(rawResults)) {',
    '    for (const r of rawResults) {',
    '      resultsList.push({ title: r.title || "", link: r.url || r.link || r.href || "", snippet: r.content || r.snippet || r.body || "" });',
    '    }',
    '  }',
    '  if (Array.isArray(res.places)) {',
    '    for (const p of res.places) {',
    '      resultsList.push({ title: p.title || p.name || "", link: p.website || p.link || p.url || "", snippet: p.address || p.category || "" });',
    '    }',
    '  }',
    '  for (const r of resultsList) {',
    '    const title = r.title;',
    '    const link = r.link;',
    '    const snippet = r.snippet;',
    '    if (!link || seenUrls.has(link)) continue;',
    '    if (blacklistDomains.some(domain => link.toLowerCase().includes(domain))) continue;',
    '    const titleLower = title.toLowerCase();',
    '    if (blacklistTitle.some(term => titleLower.includes(term))) continue;',
    '    seenUrls.add(link);',
    '    const textoCompleto = title + " " + snippet + " " + link;',
    '    const whatsapp = extrairWhatsapp(textoCompleto);',
    '    const waUsername = extrairWaUsername(link);',
    '    let whatsappFinal = null;',
    '    let linkWhatsappFinal = null;',
    '    if (whatsapp) {',
    '      whatsappFinal = whatsapp.replace(/\\D/g, "");',
    '      if (whatsappFinal.length === 11) whatsappFinal = "55" + whatsappFinal;',
    '      linkWhatsappFinal = "https://wa.me/" + whatsappFinal;',
    '    }',
    '    const nomePerfil = limparNomePerfil(title);',
    '    if (nomePerfil === "Desconhecido" && !whatsappFinal) continue;',
    '    items.push({',
    '      json: {',
    '        niche_id: nicheId,',
    '        nome_perfil: nomePerfil,',
    '        wa_username: waUsername || null,',
    '        whatsapp: whatsappFinal,',
    '        link_whatsapp: linkWhatsappFinal,',
    '        snippet: snippet.slice(0, 300),',
    '        fonte_url: link,',
    '        original_query: currentQuery,',
    '        status: whatsappFinal ? "pendente" : "sem_telefone"',
    '      }',
    '    });',
    '  }',
    '}',
    'return items.length > 0 ? items : [{ json: { aviso: "Nenhum link valido encontrado nos resultados." } }];'
  ].join('\n');

  // 3. Extrai WhatsApp do HTML baixado (Higienizado contra ReDoS/Trava de Runner)
  const extraiHtmlCode = [
    'const dddsValidos = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);',
    'function extrairWhatsapp(texto) {',
    '  if (!texto || typeof texto !== "string") return null;',
    '  const matchWaUrl = texto.match(/(?:wa\\.me\\/|phone=|whatsapp\\.com\\/send\\?phone=|api\\.whatsapp\\.com\\/send\\?phone=)(\\d{10,13})/i);',
    '  if (matchWaUrl) {',
    '    let num = matchWaUrl[1].replace(/\\D/g, "");',
    '    if (num.length === 11) num = "55" + num;',
    '    if (num.length === 13 && num.startsWith("55")) return num;',
    '  }',
    '  const regex = /(?:\\+?55)?[\\s.-]?\\(?([1-9]{2})\\)?[\\s.-]?9?\\d{4}[\\s.-]?\\d{4}/g;',
    '  const matches = texto.match(regex) || [];',
    '  for (const m of matches) {',
    '    const digitos = m.replace(/\\D/g, "");',
    '    let numCompleto = digitos.length === 11 ? "55" + digitos : digitos;',
    '    if (numCompleto.length === 13 && numCompleto.startsWith("55")) {',
    '      const ddd = parseInt(numCompleto.substring(2, 4), 10);',
    '      if (dddsValidos.has(ddd) && numCompleto[4] === "9") return numCompleto;',
    '    }',
    '  }',
    '  return null;',
    '}',
    '',
    'const allInputs = $input.all();',
    'const items = [];',
    'for (let i = 0; i < allInputs.length; i++) {',
    '  const inputItem = allInputs[i];',
    '  let leadOriginal = {};',
    '  try {',
    '    leadOriginal = $node["Verifica Telefone"].all()[i]?.json || {};',
    '  } catch (e) {',
    '    leadOriginal = {};',
    '  }',
    '  let rawHtml = "";',
    '  if (typeof inputItem.json === "string") {',
    '    rawHtml = inputItem.json;',
    '  } else if (inputItem.json && typeof inputItem.json.data === "string") {',
    '    rawHtml = inputItem.json.data;',
    '  } else {',
    '    rawHtml = JSON.stringify(inputItem.json || {});',
    '  }',
    '  const htmlText = rawHtml.replace(/<script[\\s\\S]*?<\\/script>/gi, "").replace(/<style[\\s\\S]*?<\\/style>/gi, "").slice(0, 150000);',
    '  let whatsappEncontrado = extrairWhatsapp(htmlText);',
    '  let whatsappFinal = whatsappEncontrado || leadOriginal.whatsapp || null;',
    '  let linkWhatsappFinal = leadOriginal.link_whatsapp || null;',
    '  let statusFinal = leadOriginal.status || "sem_telefone";',
    '  if (whatsappEncontrado) {',
    '    whatsappFinal = whatsappEncontrado.replace(/\\D/g, "");',
    '    if (whatsappFinal.length === 11) whatsappFinal = "55" + whatsappFinal;',
    '    linkWhatsappFinal = "https://wa.me/" + whatsappFinal;',
    '    statusFinal = "pendente";',
    '  }',
    '  items.push({',
    '    json: {',
    '      niche_id: leadOriginal.niche_id || "' + nicheId + '",',
    '      nome_perfil: leadOriginal.nome_perfil || "Desconhecido",',
    '      wa_username: leadOriginal.wa_username || null,',
    '      whatsapp: whatsappFinal,',
    '      link_whatsapp: linkWhatsappFinal,',
    '      snippet: leadOriginal.snippet || "",',
    '      fonte_url: leadOriginal.fonte_url || "",',
    '      original_query: leadOriginal.original_query || "",',
    '      status: statusFinal',
    '    }',
    '  });',
    '}',
    'return items;'
  ].join('\n');

  // 4. Sanitiza Dados (Tratamento contra strings nulas/undefined)
  const sanitizaDadosCode = [
    'const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;',
    "const NICHE_ID_FIXO = '" + nicheId + "';",
    'const out = [];',
    'for (const item of $input.all()) {',
    '  const j = item.json;',
    '  if (j.aviso) { out.push({ json: j }); continue; }',
    '  let nicheIdFinal = j.niche_id;',
    '  if (!nicheIdFinal || nicheIdFinal === "undefined" || nicheIdFinal === "null" || !UUID_REGEX.test(String(nicheIdFinal))) {',
    '    nicheIdFinal = NICHE_ID_FIXO;',
    '  }',
    '  let whatsapp = j.whatsapp;',
    '  if (whatsapp && (whatsapp === "undefined" || whatsapp === "null")) whatsapp = null;',
    '  let waUsername = j.wa_username;',
    '  if (waUsername && (waUsername === "undefined" || waUsername === "null")) waUsername = null;',
    '  let linkWhatsapp = j.link_whatsapp;',
    '  if (linkWhatsapp && (linkWhatsapp === "undefined" || linkWhatsapp === "null")) linkWhatsapp = null;',
    '  let nomePerfil = j.nome_perfil;',
    '  if (!nomePerfil || nomePerfil === "undefined" || nomePerfil === "null") nomePerfil = "Desconhecido";',
    '  let snippet = j.snippet;',
    '  if (!snippet || snippet === "undefined" || snippet === "null") snippet = "";',
    '  let fonteUrl = j.fonte_url;',
    '  if (!fonteUrl || fonteUrl === "undefined" || fonteUrl === "null") fonteUrl = "";',
    '  let originalQuery = j.original_query;',
    '  if (!originalQuery || originalQuery === "undefined" || originalQuery === "null") originalQuery = "";',
    '  out.push({',
    '    json: {',
    '      niche_id: nicheIdFinal,',
    '      nome_perfil: nomePerfil,',
    '      wa_username: waUsername,',
    '      whatsapp: whatsapp,',
    '      link_whatsapp: linkWhatsapp,',
    '      snippet: snippet,',
    '      fonte_url: fonteUrl,',
    '      original_query: originalQuery,',
    '      status: j.status || "sem_telefone"',
    '    }',
    '  });',
    '}',
    'return out;'
  ].join('\n');

  const nodes = [
    {
      id: 'trigger',
      name: 'Schedule Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.3,
      position: [0, 0],
      parameters: { rule: { interval: [{ field: 'hours', hoursInterval: scheduleHours }] } },
    },
    {
      id: 'webhook',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [0, 150],
      parameters: { httpMethod: 'GET', path: `raspagem-${nicheId}`, responseMode: 'onReceived', options: {} },
    },
    {
      id: 'gera_queries',
      name: 'Gera Queries de Busca',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { jsCode: geraQueriesCode },
    },
    {
      id: 'busca_serper',
      name: 'Busca Serper API',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.4,
      position: [440, -120],
      onError: 'continueErrorOutput',
      parameters: {
        method: 'POST',
        url: 'https://google.serper.dev/search',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'X-API-KEY', value: serperApiKey },
            { name: 'Content-Type', value: 'application/json' },
          ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ q: $json.q }) }}',
      },
    },
    {
      id: 'busca_searxng',
      name: 'Busca SearXNG',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.4,
      position: [440, 120],
      onError: 'continueErrorOutput',
      parameters: {
        method: 'GET',
        url: searxngUrl,
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'q', value: '={{ $json.q }}' },
            { name: 'format', value: 'json' }
          ]
        },
      },
    },
    {
      id: 'extrai_leads',
      name: 'Extrai e Formata Leads',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [680, 0],
      parameters: { jsCode: extraiLeadsCode },
    },
    {
      id: 'verifica_telefone',
      name: 'Verifica Telefone',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [900, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: 'cond_sem_tel',
              leftValue: '={{ $json.status }}',
              rightValue: 'sem_telefone',
              operator: { type: 'string', operation: 'equals' }
            }
          ],
          combinator: 'and'
        }
      }
    },
    {
      id: 'raspa_html_fonte',
      name: 'Raspa HTML da Fonte',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.4,
      position: [1120, -100],
      onError: 'continueRegularOutput',
      parameters: {
        method: 'GET',
        url: '={{ $json.fonte_url }}',
        responseFormat: 'text',
        options: {
          redirects: { redirect: { followRedirects: true } },
          timeout: 8000
        },
        headerParameters: {
          parameters: [
            {
              name: 'User-Agent',
              value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          ]
        }
      }
    },
    {
      id: 'extrai_whatsapp_html',
      name: 'Extrai WhatsApp do HTML',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1340, -100],
      parameters: { jsCode: extraiHtmlCode },
    },
    {
      id: 'sanitiza_dados',
      name: 'Sanitiza Dados',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1560, 0],
      parameters: { jsCode: sanitizaDadosCode },
    },
    {
      id: 'salva_postgres',
      name: 'Salva Leads no Postgres',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1780, 0],
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO leads (niche_id, nome_perfil, wa_username, whatsapp, link_whatsapp, snippet, fonte_url, original_query, status)
VALUES (
  '${nicheId}',
  {{ $json.nome_perfil ? "'" + String($json.nome_perfil).replace(/'/g, "''") + "'" : "'Desconhecido'" }},
  {{ $json.wa_username ? "'" + String($json.wa_username).replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.whatsapp ? "'" + String($json.whatsapp).replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.link_whatsapp ? "'" + String($json.link_whatsapp).replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.snippet ? "'" + String($json.snippet).replace(/'/g, "''") + "'" : "''" }},
  {{ $json.fonte_url ? "'" + String($json.fonte_url).replace(/'/g, "''") + "'" : "''" }},
  {{ $json.original_query ? "'" + String($json.original_query).replace(/'/g, "''") + "'" : "''" }},
  {{ $json.status ? "'" + String($json.status).replace(/'/g, "''") + "'" : "'sem_telefone'" }}
)
ON CONFLICT (niche_id, whatsapp) DO NOTHING;`,
      },
      credentials: postgresCredentialId ? { postgres: { id: postgresCredentialId, name: 'Postgres account' } } : undefined,
    },
  ];

  const connections = {
    'Schedule Trigger': { main: [[{ node: 'Gera Queries de Busca', type: 'main', index: 0 }]] },
    'Webhook': { main: [[{ node: 'Gera Queries de Busca', type: 'main', index: 0 }]] },
    'Gera Queries de Busca': {
      main: [
        [
          { node: 'Busca Serper API', type: 'main', index: 0 },
          { node: 'Busca SearXNG', type: 'main', index: 0 }
        ]
      ]
    },
    'Busca Serper API': { main: [[{ node: 'Extrai e Formata Leads', type: 'main', index: 0 }]] },
    'Busca SearXNG': { main: [[{ node: 'Extrai e Formata Leads', type: 'main', index: 0 }]] },
    'Extrai e Formata Leads': { main: [[{ node: 'Verifica Telefone', type: 'main', index: 0 }]] },
    'Verifica Telefone': {
      main: [
        [{ node: 'Raspa HTML da Fonte', type: 'main', index: 0 }],
        [{ node: 'Sanitiza Dados', type: 'main', index: 0 }]
      ]
    },
    'Raspa HTML da Fonte': { main: [[{ node: 'Extrai WhatsApp do HTML', type: 'main', index: 0 }]] },
    'Extrai WhatsApp do HTML': { main: [[{ node: 'Sanitiza Dados', type: 'main', index: 0 }]] },
    'Sanitiza Dados': { main: [[{ node: 'Salva Leads no Postgres', type: 'main', index: 0 }]] },
  };

  return {
    name: '[Maquina de Leads] Raspagem Dual - ' + nicheName,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    active: false,
  };
}

module.exports = { buildScrapingWorkflow };
