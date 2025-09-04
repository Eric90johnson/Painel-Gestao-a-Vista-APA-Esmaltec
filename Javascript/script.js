document.addEventListener('DOMContentLoaded', () => {
    // Seleciona os elementos do DOM
    const fileInput = document.getElementById('fileInput');
    const importarBtn = document.getElementById('importarBtn');
    const pasteData = document.getElementById('pasteData');
    const pasteBtn = document.getElementById('pasteBtn');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn'); // Botão de reset
    const tabelaCorpo = document.querySelector('#painelTable tbody');

    // --- CONFIGURAÇÃO DOS MODAIS ---
    const alertModalEl = document.getElementById('alertModal');
    const alertModal = new bootstrap.Modal(alertModalEl);

    const resetModalEl = document.getElementById('resetConfirmModal');
    const resetModal = new bootstrap.Modal(resetModalEl);
    const confirmResetBtn = document.getElementById('confirmResetBtn');


    // Listener para o modal de alerta (garante a limpeza do backdrop)
    alertModalEl.addEventListener('hidden.bs.modal', () => {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.style.overflow = 'auto';
    });


    // Chave para usar no localStorage
    const localStorageKey = 'painelGestaoDados';
    let unsavedChanges = false;

    // Mapeamento das colunas
    const colunaMap = {
        'Janela': 'JANELA',
        'Carreta na Doca': 'CARRETA NA DOCA',
        'Placa': 'PLACA DO VEÍCULO',
        'Cliente': 'CLIENTE',
        'Volume': 'VOLUMES',
    };

    // --- CARREGAMENTO INICIAL ---
    loadData();

    // --- EVENT LISTENERS ---

    importarBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => processRawData(e.target.result);
            reader.readAsText(file, 'ISO-8859-1');
        } else {
            showBootstrapAlert('Por favor, selecione um arquivo CSV para importar.', 'Atenção!', 'warning');
        }
    });

    pasteBtn.addEventListener('click', () => {
        const data = pasteData.value;
        if (data.trim()) {
            processRawData(data);
        } else {
            showBootstrapAlert('Por favor, cole os dados da sua planilha na caixa de texto.', 'Atenção!', 'warning');
        }
    });

    saveBtn.addEventListener('click', saveData);

    // Abre o modal de confirmação ao clicar no botão de reset
    resetBtn.addEventListener('click', () => {
        resetModal.show();
    });

    // Executa a limpeza ao confirmar no modal
    confirmResetBtn.addEventListener('click', () => {
        // Limpa a tabela na tela
        tabelaCorpo.innerHTML = '';

        // Limpa os dados salvos no navegador
        localStorage.removeItem(localStorageKey);

        // Reseta o controle de alterações não salvas
        unsavedChanges = false;

        // Esconde o modal de confirmação
        resetModal.hide();

        // Informa o usuário que a operação foi um sucesso
        showBootstrapAlert('Todos os dados foram apagados com sucesso.', 'Tabela Limpa', 'success');
    });


    window.addEventListener('beforeunload', (e) => {
        if (unsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });


    // --- FUNÇÕES PRINCIPAIS ---

    /**
     * Exibe um modal de alerta customizado do Bootstrap.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} title - O título do modal.
     * @param {string} type - 'success', 'warning', ou 'danger' para colorir o cabeçalho.
     */
    function showBootstrapAlert(message, title = 'Aviso do Painel', type = 'primary') {
        const modalTitle = document.getElementById('alertModalLabel');
        const modalBody = document.getElementById('alertModalBody');
        const modalHeader = document.getElementById('alertModalHeader');

        modalTitle.textContent = title;
        modalBody.textContent = message;

        modalHeader.className = 'modal-header';
        if (type === 'success') {
            modalHeader.classList.add('bg-success', 'text-white');
        } else if (type === 'warning') {
            modalHeader.classList.add('bg-warning', 'text-dark');
        } else if (type === 'danger') {
            modalHeader.classList.add('bg-danger', 'text-white');
        } else if (type === 'info') {
             modalHeader.classList.add('bg-info', 'text-white');
        }

        alertModal.show();
    }


    /**
     * Processa os dados brutos (de arquivo ou colados) e renderiza a tabela.
     * @param {string} rawData
     */
    function processRawData(rawData) {
        try {
            const { cabecalho, dados } = parseData(rawData);
            renderizarTabela(dados, cabecalho);
            unsavedChanges = true;
            showBootstrapAlert('Dados importados! Lembre-se de salvar as alterações clicando no ícone de disquete.', 'Importação Concluída', 'info');
        } catch (error) {
            console.error('Erro ao processar dados:', error);
            showBootstrapAlert(`Erro ao processar os dados: ${error.message}`, 'Erro na Importação', 'danger');
        }
    }

    /**
     * Salva o conteúdo atual da tabela no localStorage.
     */
    function saveData() {
        const tableData = [];
        const tableRows = tabelaCorpo.querySelectorAll('tr');

        tableRows.forEach(row => {
            const rowData = [];
            row.querySelectorAll('td').forEach(cell => {
                const input = cell.querySelector('input, select');
                if (input) {
                    rowData.push(input.value);
                } else {
                    rowData.push(cell.textContent);
                }
            });
            tableData.push(rowData);
        });

        localStorage.setItem(localStorageKey, JSON.stringify(tableData));
        unsavedChanges = false;
        showBootstrapAlert('Seus dados foram salvos com sucesso no navegador!', 'Dados Salvos', 'success');
    }

    /**
     * Carrega os dados do localStorage ao iniciar a página.
     */
    function loadData() {
        const savedData = localStorage.getItem(localStorageKey);
        if (savedData) {
            const tableData = JSON.parse(savedData);
            renderizarTabelaFromSavedData(tableData);
        }
    }

    /**
     * Analisa os dados brutos para extrair cabeçalho e linhas.
     * @param {string} rawData
     * @returns {{cabecalho: string[], dados: string[]}}
     */
    function parseData(rawData) {
        const linhas = rawData.trim().replace(/\r/g, '').split('\n');
        if (linhas.length < 1) throw new Error("Dados inválidos.");

        let cabecalho, dados;
        const headerIndex = linhas.findIndex(linha =>
            parseCsvLine(linha).some(c => c.toLowerCase().includes('janela') || c.toLowerCase().includes('placa'))
        );

        if (headerIndex !== -1) {
            cabecalho = parseCsvLine(linhas[headerIndex]);
            dados = linhas.slice(headerIndex + 1);
        } else {
            cabecalho = parseCsvLine(linhas[0]);
            dados = linhas.slice(1);
        }
        return { cabecalho, dados };
    }

    /**
     * Analisa uma linha de texto delimitado.
     * @param {string} line
     * @returns {string[]}
     */
    function parseCsvLine(line) {
        const result = [];
        let inQuotes = false;
        let currentField = '';
        const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"' && inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        result.push(currentField.trim());
        return result.map(field => field.replace(/^"|"$/g, ''));
    }

    /**
     * Renderiza a tabela a partir de dados importados (CSV ou colados).
     * @param {string[]} dados
     * @param {string[]} cabecalho
     */
    function renderizarTabela(dados, cabecalho) {
        tabelaCorpo.innerHTML = '';
        if (dados.length === 0 || (dados.length === 1 && dados[0].trim() === '')) return;

        dados.forEach(linha => {
            if (!linha.trim()) return;
            const colunas = parseCsvLine(linha);
            if (colunas.length <= 1) return;

            const row = document.createElement('tr');
            Object.values(colunaMap).forEach(nomeColunaTabela => {
                const nomeColunaCSV = Object.keys(colunaMap).find(key => colunaMap[key] === nomeColunaTabela);
                const indice = cabecalho.findIndex(h => h.toLowerCase() === nomeColunaCSV.toLowerCase());
                const valor = (indice !== -1 && colunas[indice]) ? colunas[indice].replace(/"/g, '').trim() : '';
                const cell = document.createElement('td');
                cell.textContent = valor;
                row.appendChild(cell);
            });

            row.innerHTML += `
                <td><select class="form-select form-select-sm"><option>Selecione...</option></select></td>
                <td><select class="form-select form-select-sm"><option>Selecione...</option></select></td>
                <td><input type="time" class="form-control form-control-sm"></td>
                <td><input type="time" class="form-control form-control-sm"></td>
                <td><div class="status-circle"></div></td>
                <td><select class="form-select form-select-sm"><option>Selecione...</option></select></td>
            `;
            tabelaCorpo.appendChild(row);
        });
    }

    /**
     * Renderiza a tabela a partir de dados já salvos no localStorage.
     * @param {Array<Array<string>>} tableData
     */
    function renderizarTabelaFromSavedData(tableData) {
        tabelaCorpo.innerHTML = '';
        tableData.forEach(rowData => {
            const row = document.createElement('tr');
for (let i = 0; i < 5; i++)