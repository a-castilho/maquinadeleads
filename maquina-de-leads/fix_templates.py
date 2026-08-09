import re

# --- scrapingTemplate.js ---
path1 = "backend/src/templates/scrapingTemplate.js"
with open(path1, "r", encoding="utf-8") as f:
        content1 = f.read()

        old_query = '''        query: `INSERT INTO leads (niche_id, nome_perfil, whatsapp, wa_username, link_whatsapp, link_instagram, snippet, fonte_url, original_query, status)
        VALUES ('${nicheId}', {{ $json.nome_perfil }}, {{ $json.whatsapp }}, {{ $json.wa_username }}, {{ $json.link_whatsapp }}, {{ $json.fonte_url }}, {{ $json.snippet }}, {{ $json.fonte_url }}, {{ $json.original_query }}, 'pendente')
        ON CONFLICT (niche_id, whatsapp) DO NOTHING;`,'''

        new_query = '''        query: `INSERT INTO leads (niche_id, nome_perfil, whatsapp, wa_username, link_whatsapp, link_instagram, snippet, fonte_url, original_query, status)
        VALUES (
          '${nicheId}',
            {{ $json.nome_perfil ? "'" + String($json.nome_perfil).replace(/'/g, "''") + "'" : 'NULL' }},
              {{ $json.whatsapp ? "'" + String($json.whatsapp).replace(/'/g, "''") + "'" : 'NULL' }},
                {{ $json.wa_username ? "'" + String($json.wa_username).replace(/'/g, "''") + "'" : 'NULL' }},
                  {{ $json.link_whatsapp ? "'" + String($json.link_whatsapp).replace(/'/g, "''") + "'" : 'NULL' }},
                    {{ $json.fonte_url ? "'" + String($json.fonte_url).replace(/'/g, "''") + "'" : 'NULL' }},
                      {{ $json.snippet ? "'" + String($json.snippet).replace(/'/g, "''") + "'" : 'NULL' }},
                        {{ $json.fonte_url ? "'" + String($json.fonte_url).replace(/'/g, "''") + "'" : 'NULL' }},
                          {{ $json.original_query ? "'" + String($json.original_query).replace(/'/g, "''") + "'" : 'NULL' }},
                            'pendente'
                            )
                            ON CONFLICT (niche_id, whatsapp) DO NOTHING;`,'''

                            if old_query in content1:
                                    content1 = content1.replace(old_query, new_query)
                                        with open(path1, "w", encoding="utf-8") as f:
                                                    f.write(content1)
                                                        print("OK: scrapingTemplate.js corrigido")
                                                    else:
                                                            print("AVISO: trecho antigo nao encontrado em scrapingTemplate.js (pode ja estar corrigido ou diferente)")

                                                            # --- extrairWhatsapp regex fix ---
                                                            old_regex = '''const rePhone = /(\\\\+55\\\\s*)?\\\\(?(\\\\d{2})\\\\)?[\\\\s-]?(\\\\d{4,5})[\\\\s-]?(\\\\d{4})(?!\\\\d)/g;
                                                            function extrairWhatsapp(texto) {
                                                              if (!texto) return null;
                                                                let match;
                                                                  while ((match = rePhone.exec(texto)) !== null) {
                                                                      const ddd = match[2], p1 = match[3], p2 = match[4];
                                                                          if (p1.length >= 4) return \\`55\\${ddd}\\${p1}\\${p2}\\`;
                                                                            }
                                                                              return null;
                                                                              }'''

                                                                              new_regex = '''function extrairWhatsapp(texto) {
                                                                                if (!texto) return null;
                                                                                  const candidatos = texto.match(/(?:\\\\+?55[\\\\s.\\\\-]?)?\\\\(?\\\\d{2}\\\\)?[\\\\s.\\\\-]?9?[\\\\s.\\\\-]?\\\\d{4}[\\\\s.\\\\-]?\\\\d{4}/g) || [];
                                                                                    for (const c of candidatos) {
                                                                                        let digits = c.replace(/\\\\D/g, '');
                                                                                            if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
                                                                                                if (digits.length === 10 || digits.length === 11) return '55' + digits;
                                                                                                  }
                                                                                                    return null;
                                                                                                    }'''

                                                                                                    if old_regex in content1:
                                                                                                            content1 = content1.replace(old_regex, new_regex)
                                                                                                                with open(path1, "w", encoding="utf-8") as f:
                                                                                                                            f.write(content1)
                                                                                                                                print("OK: regex de whatsapp tambem corrigida")
                                                                                                                            else:
                                                                                                                                    print("INFO: regex antiga nao encontrada (talvez ja tenha sido corrigida ou o arquivo mudou)")

                                                                                                                                    # --- sendingTemplate.js ---
                                                                                                                                    path2 = "backend/src/templates/sendingTemplate.js"
                                                                                                                                    with open(path2, "r", encoding="utf-8") as f:
                                                                                                                                            content2 = f.read()

                                                                                                                                            old_sucesso = '''        query: "UPDATE leads SET status = 'enviado', ultima_mensagem_enviada = NOW() WHERE id = {{ $('formataCel').item.json.id }};",'''
                                                                                                                                            new_sucesso = '''        query: "UPDATE leads SET status = 'enviado', ultima_mensagem_enviada = NOW() WHERE id = '{{ $('formataCel').item.json.id }}';",'''

                                                                                                                                            old_erro = '''        query: "UPDATE leads SET status = 'erro' WHERE id = {{ $('formataCel').item.json.id }};",'''
                                                                                                                                            new_erro = '''        query: "UPDATE leads SET status = 'erro' WHERE id = '{{ $('formataCel').item.json.id }}';",'''

                                                                                                                                            changed = False
                                                                                                                                            if old_sucesso in content2:
                                                                                                                                                    content2 = content2.replace(old_sucesso, new_sucesso)
                                                                                                                                                        changed = True
                                                                                                                                                        if old_erro in content2:
                                                                                                                                                                content2 = content2.replace(old_erro, new_erro)
                                                                                                                                                                    changed = True

                                                                                                                                                                    if changed:
                                                                                                                                                                            with open(path2, "w", encoding="utf-8") as f:
                                                                                                                                                                                        f.write(content2)
                                                                                                                                                                                            print("OK: sendingTemplate.js corrigido")
                                                                                                                                                                                        else:
                                                                                                                                                                                                print("AVISO: trechos antigos nao encontrados em sendingTemplate.js")
