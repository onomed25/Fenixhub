const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config();

const OUTPUT_DIR = path.join(__dirname, '..', 'fenix jsons');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Tentar extrair de arquivo SQL/backup caso exista nos Downloads ou na pasta do projeto
async function tryExtractFromFile(filePath) {
    console.log(`\n🔍 Analisando arquivo de backup: ${filePath}...`);
    let content = '';
    try {
        if (filePath.endsWith('.gz')) {
            const buffer = fs.readFileSync(filePath);
            content = zlib.gunzipSync(buffer).toString('utf8');
        } else {
            content = fs.readFileSync(filePath, 'utf8');
        }
    } catch (e) {
        console.log(`Erro ao ler ${filePath}: ${e.message}`);
        return 0;
    }
    
    let count = 0;
    
    // Procura por JSONs em formato pg_dump (COPY arquivos_json ou INSERT)
    // 1. Formato COPY
    if (content.includes('arquivos_json')) {
        const lines = content.split('\n');
        let inCopy = false;
        for (const line of lines) {
            if (line.includes('COPY') && line.includes('arquivos_json')) {
                inCopy = true;
                continue;
            }
            if (inCopy) {
                if (line.trim() === '\\.') {
                    inCopy = false;
                    break;
                }
                const tabs = line.split('\t');
                // formato padrão: nome_do_json, conteudo, ...
                for (let i = 0; i < tabs.length; i++) {
                    const cell = tabs[i].trim();
                    if (cell.startsWith('{') && cell.endsWith('}')) {
                        try {
                            const parsed = JSON.parse(cell);
                            const name = (tabs[0].trim() || `item_${count + 1}`).replace(/^'|'$/g, '');
                            const safeName = (name.endsWith('.json') ? name : `${name}.json`).replace(/[\/\\:*?"<>|]/g, '_');
                            fs.writeFileSync(path.join(OUTPUT_DIR, safeName), JSON.stringify(parsed, null, 2), 'utf8');
                            count++;
                            break;
                        } catch (_) {}
                    }
                }
            }
        }
    }

    // 2. Formato INSERT
    if (count === 0) {
        const insertRegex = /INSERT INTO\s+(?:public\.)?arquivos_json[^(]*\((.*?)\)\s*VALUES\s*\((.*?)\);/gis;
        let match;
        while ((match = insertRegex.exec(content)) !== null) {
            try {
                const valuesStr = match[2];
                // Procura objeto JSON {...} dentro de values
                const jsonMatch = valuesStr.match(/('|\$JSON\$|\$tag\$)(\{.*?\})(\1|\$JSON\$|\$tag\$)/s) || valuesStr.match(/(\{.*\})/s);
                if (jsonMatch) {
                    const rawJson = jsonMatch[2] || jsonMatch[1];
                    const cleanJson = rawJson.replace(/''/g, "'");
                    const parsed = JSON.parse(cleanJson);
                    const title = parsed.title || parsed.name || `filme_${count + 1}`;
                    const safeName = `${title.replace(/[\/\\:*?"<>| ]/g, '_')}.json`;
                    fs.writeFileSync(path.join(OUTPUT_DIR, safeName), JSON.stringify(parsed, null, 2), 'utf8');
                    count++;
                }
            } catch (_) {}
        }
    }

    return count;
}

// 2. Tentar extrair direto do banco PostgreSQL se estiver online
async function tryExtractFromDatabase() {
    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000
    });

    console.log('\n🔌 Tentando conectar ao banco de dados Supabase via DATABASE_URL...');
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');

    const res = await client.query('SELECT nome_do_json, conteudo FROM arquivos_json;');
    console.log(`📦 Encontrados ${res.rows.length} itens no banco de dados.`);

    let count = 0;
    for (const row of res.rows) {
        const name = row.nome_do_json || `item_${count + 1}`;
        const safeName = (name.endsWith('.json') ? name : `${name}.json`).replace(/[\/\\:*?"<>|]/g, '_');
        const dest = path.join(OUTPUT_DIR, safeName);
        const data = typeof row.conteudo === 'string' ? JSON.parse(row.conteudo) : row.conteudo;
        fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');
        count++;
    }

    await client.end();
    return count;
}

async function main() {
    console.log(`📁 Pasta de destino: ${OUTPUT_DIR}`);

    // Passo 1: Tenta conectar direto ao banco online
    try {
        const count = await tryExtractFromDatabase();
        if (count > 0) {
            console.log(`\n🎉 SUCESSO! ${count} arquivos JSON foram salvos na pasta 'fenix jsons'!`);
            return;
        }
    } catch (dbErr) {
        console.log(`⚠️ Banco online ainda não respondeu: ${dbErr.message}`);
    }

    // Passo 2: Procura por arquivos de backup baixados (.sql, .dump, .tar, .gz) na pasta Downloads
    console.log('\n🔎 Verificando se você já baixou o arquivo de backup em Downloads...');
    const searchDirs = [
        path.join(process.env.HOME || '/home/onomed', 'Downloads'),
        path.join(__dirname, '..')
    ];

    let foundFiles = [];
    for (const d of searchDirs) {
        if (fs.existsSync(d)) {
            const files = fs.readdirSync(d);
            for (const f of files) {
                if ((f.endsWith('.sql') || f.endsWith('.dump') || f.endsWith('.tar') || f.endsWith('.sql.gz')) && !f.endsWith('.storage.zip')) {
                    foundFiles.push(path.join(d, f));
                }
            }
        }
    }

    if (foundFiles.length > 0) {
        console.log(`Encontrados ${foundFiles.length} arquivo(s) de backup.`);
        for (const file of foundFiles) {
            const extracted = await tryExtractFromFile(file);
            if (extracted > 0) {
                console.log(`🎉 Extraídos ${extracted} JSONs de ${file} para a pasta 'fenix jsons'!`);
                return;
            }
        }
    }

    console.log('\n======================================================');
    console.log('📌 O QUE FAZER AGORA:');
    console.log('1. No Supabase, clique no botão de download do "Database" (.sql).');
    console.log('2. Assim que o arquivo for salvo nos seus Downloads, avise que executo o script na hora!');
    console.log('======================================================');
}

main();
