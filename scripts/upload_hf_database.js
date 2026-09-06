require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { uploadFiles } = require('@huggingface/hub');

async function uploadToHf() {
    const token = (process.env.HF_TOKEN || '').trim();
    const repo = (process.env.HF_DATABASE_REPO || 'Fenixflix/Database').trim();
    const repoType = (process.env.HF_DATABASE_TYPE || 'dataset').trim();
    const jsonDir = path.join(__dirname, '..', 'fenix jsons');

    console.log('🚀 Iniciando envio de JSONs para o Hugging Face Database...');
    console.log(`📦 Repositório: ${repo} (tipo: ${repoType})`);

    if (!token) {
        console.error('❌ ERRO: HF_TOKEN não está configurado no arquivo .env!');
        console.log('Gere um token com permissão WRITE ou READ em: https://huggingface.co/settings/tokens');
        process.exit(1);
    }

    if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
    }

    const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
        console.log(`⚠️ Nenhum arquivo .json encontrado na pasta 'fenix jsons'.`);
        console.log(`Coloque seus arquivos .json dentro de 'fenix jsons/' para enviar ao Hugging Face.`);
        return;
    }

    console.log(`📄 Encontrados ${files.length} arquivo(s) JSON para enviar.`);

    const filesToUpload = files.map(filename => {
        const fullPath = path.join(jsonDir, filename);
        return {
            path: filename,
            content: new Blob([fs.readFileSync(fullPath)])
        };
    });

    try {
        await uploadFiles({
            repo: {
                type: repoType,
                name: repo
            },
            credentials: {
                accessToken: token
            },
            files: filesToUpload,
            commitMessage: `Upload de ${files.length} JSONs do catálogo Fenixflix`
        });

        console.log(`\n🎉 SUCESSO! Todos os ${files.length} arquivos foram enviados para https://huggingface.co/datasets/${repo}`);
    } catch (err) {
        console.error(`\n❌ Falha ao enviar para o Hugging Face: ${err.message}`);
        if (err.message.includes('401')) {
            console.log('💡 Dica: Para enviar arquivos, o seu token precisa de permissão WRITE (escrita).');
        }
    }
}

if (require.main === module) {
    uploadToHf();
}

module.exports = { uploadToHf };
