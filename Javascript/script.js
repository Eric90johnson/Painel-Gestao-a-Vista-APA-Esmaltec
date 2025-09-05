document.addEventListener('DOMContentLoaded', () => {
    // Seleciona os elementos do DOM
    const fileInput = document.getElementById('fileInput');
    const importarBtn = document.getElementById('importarBtn');
    const pasteData = document.getElementById('pasteData');
    const pasteBtn = document.getElementById('pasteBtn');
    const saveBtn = document.getElementById('saveBtn');
    const tabelaCorpo = document.querySelector('#painelTable tbody');

    // Instancia o Modal do Bootstrap
    const modalElement = document.getElementById('alertModal');
    const alertModal = new bootstrap.Modal(modalElement);

    // Listener para garantir que o backdrop seja removido ao fechar o modal
    modalElement.addEventListener('hidden.bs.modal', () => {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.style.overflow = 'auto';
    });

    // Chave para usar no localStorage
    const localStorageKey = 'painelGestaoDados';
    let unsavedChanges = false;

    // --- LISTAS PARA OS SELECTS ---
    const listaDeConferentes = [
        'Selecione...', 'ALMREP', 'ARIONALDO', 'ARLLYSON', 'CÍCERO', 'ERISOM',
        'ERNANDES', 'FABIANO', 'FÁBIO', 'FRANCIE', 'ISMAEL', 'JOEL',
        'MICIANO', 'TIAGO', 'WENDEL'
    ].sort((a, b) => {
        if (a === 'Selecione...') return -1;
        if (b === 'Selecione...') return 1;
        return a.localeCompare(b);
    });
    const listaDeDocas = ['Selecione...', 'DOCA1', 'DOCA2', 'DOCA3', 'DOCA4', 'DOCA5', 'DOCA6', 'DOCA7', 'DOCA8', 'DOCA9', 'DOCA10'];
    const listaDeObservacoes = [
        'Selecione...', 'ABSENTEÍSMO CAPATAZIA', 'ABSENTEÍSMO ESMALTEC', 'AGUARDANDO COMPLEMENTO DE CARGA',
        'ANTECIPADO', 'APA EM FALHAS CONSTANTES', 'APA EM MANUTENÇÃO', 'ATRASO - COMERCIAL DIURNO',
        'ATRASO - COMERCIAL NOTURNO', 'ATRASO - PROGRAMAÇÃO LOGÍSTICA', 'ATRASO - QUEDA DE CONTENTOR NO APA',
        'ATRASO - VEÍCULO NÃO SE APRESENTOU', 'ATRASO - WMS SEM CONEXÃO COM A REDE', 'CARREGAMENTO NO APA2',
        'DESISTÊNCIA DO MOTORISTA', 'FALHA OPERACIONAL DA EXPEDIÇÃO', 'LOGÍSTICA REVERSA',
        'PEDIDO POSTERGADO PELO CLIENTE', 'PRODUTOS EM PRODUÇÃO', 'PRODUTOS MOLHADOS',
        'RECUSADO - VEÍCULO COM INFILTRAÇÃO', 'RECUSADO - VEÍCULO INADEQUADO', 'RECUSADO - VEÍCULO NÃO COUBE A CARGA',
        'SEM OS ITENS BÁSICOS PARA CARREGAMENTO', 'SEM PROGRAMAÇÃO', 'TREINAMENTO COLABORADORES NOVO WMS'
    ].sort((a, b) => {
        if (a === 'Selecione...') return -1;
        if (b === 'Selecione...') return 1;
        return a.localeCompare(b);
    });

    const cabecalhoPadrao = ['Janela', 'Local', 'Hora Prog. Distribuição', 'Carreta na Portaria', 'Entrada Portaria', 'Carreta na Doca', 'Data a Expedir', 'Transportador', 'Placa', 'PM', 'Remessa', 'Cliente', 'Destino', 'Agenda', 'Volume'];
    const colunasDesejadas = ['Janela', 'Carreta na Doca', 'Placa', 'Cliente', 'Volume'];

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

    tabelaCorpo.addEventListener('change', (e) => {
        const target = e.target;
        const targetRow = target.closest('tr');
        if (!targetRow) return;

        const placa = targetRow.cells[2].textContent;
        const cliente = targetRow.cells[3].textContent;
        const volumes = targetRow.cells[4].textContent;
        const carretaNaDoca = targetRow.cells[1].textContent;
        const inicio = targetRow.querySelector('input[data-field="inicio"]').value;
        const fim = targetRow.querySelector('input[data-field="fim"]').value;
        const obs = targetRow.querySelector('select[data-field="obs"]').value;
        const statusCircle = targetRow.querySelector('.status-circle-table');

        if (target.tagName === 'SELECT') {
            const cellIndex = target.closest('td').cellIndex;
            if (cellIndex === 5 || cellIndex === 6 || cellIndex === 10) {
                 if (target.value !== 'Selecione...') {
                    unsavedChanges = true;
                    showBootstrapAlert('Alteração detectada. Não se esqueça de salvar.', 'Alteração Detectada', 'warning');
                }
            }
            if (cellIndex === 10) {
                gerenciarEstadoInputs(targetRow);
                atualizarStatusCor(placa, cliente, volumes, carretaNaDoca, inicio, fim, obs, statusCircle);
            }
        }
        
        if (target.matches('input[type="time"]')) {
            atualizarStatusCor(placa, cliente, volumes, carretaNaDoca, inicio, fim, obs, statusCircle);
            if (carretaNaDoca && carretaNaDoca.includes(':')) {
                const dataBase = new Date('1970-01-01');
                const docaTime = new Date(`${dataBase.toDateString()} ${carretaNaDoca}`);
                if (target.dataset.field === 'inicio' && inicio) {
                    const inicioTime = new Date(`${dataBase.toDateString()} ${inicio}`);
                    if (inicioTime > docaTime) {
                        showBootstrapAlert('Início com atraso. Por favor, selecione o motivo na coluna OBS.', 'Atraso Detectado', 'warning');
                    }
                }
                if (target.dataset.field === 'fim' && fim) {
                    let fimTime = new Date(`${dataBase.toDateString()} ${fim}`);
                    if (fimTime < docaTime) fimTime.setDate(fimTime.getDate() + 1);
                    const duracaoMinutos = (fimTime - docaTime) / 60000;
                    if (duracaoMinutos > 60) {
                        showBootstrapAlert('Finalizado com atraso. Por favor, selecione o motivo na coluna OBS.', 'Atraso Detectado', 'warning');
                    }
                }
            }
            unsavedChanges = true;
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (unsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // --- NOVO EVENT LISTENER PARA O ATALHO CTRL+S ---
    document.addEventListener('keydown', (e) => {
        // Verifica se a tecla 's' (ou 'S') foi pressionada junto com a tecla Ctrl
        if ((e.key === 's' || e.key === 'S') && e.ctrlKey) {
            // Previne a ação padrão do navegador (que é salvar a página)
            e.preventDefault();
            // Chama a nossa função de salvar
            saveData();
        }
    });


    // --- FUNÇÕES ---

    function gerenciarEstadoInputs(row) {
        const placa = row.cells[2].textContent.trim();
        const cliente = row.cells[3].textContent.trim();
        const volumes = row.cells[4].textContent.trim();
        const obs = row.querySelector('select[data-field="obs"]').value;
        const conferente = row.querySelector('select[data-field="conferente"]').value;
        const doca = row.querySelector('select[data-field="doca"]').value;
        const inicio = row.querySelector('input[data-field="inicio"]').value;
        const isLinhaVazia = !placa && !cliente && !volumes;
        const isCarregamentoAtivo = conferente !== 'Selecione...' || doca !== 'Selecione...' || inicio !== '';
        const deveTravar = isLinhaVazia || (obs !== 'Selecione...' && !isCarregamentoAtivo);
        row.querySelector('select[data-field="conferente"]').disabled = deveTravar;
        row.querySelector('select[data-field="doca"]').disabled = deveTravar;
        row.querySelector('input[data-field="inicio"]').disabled = deveTravar;
        row.querySelector('input[data-field="fim"]').disabled = deveTravar;
    }

    function salvarEstadoAtualDaTabela() {
        const estados = {
            ativos: {},
            bloqueados: {}
        };
        const rows = tabelaCorpo.querySelectorAll('tr');
        rows.forEach(row => {
            const placa = row.cells[2].textContent.trim();
            const cliente = row.cells[3].textContent.trim();
            const janela = row.cells[0].textContent.trim();
            
            const conferente = row.querySelector('select[data-field="conferente"]').value;
            const doca = row.querySelector('select[data-field="doca"]').value;
            const inicio = row.querySelector('input[data-field="inicio"]').value;
            const obs = row.querySelector('select[data-field="obs"]').value;

            if (placa && cliente) {
                const chaveAtiva = `${placa}-${cliente}`;
                const chaveBloqueada = `${placa}-${cliente}-${janela}`;
                const isAtivo = conferente !== 'Selecione...' || doca !== 'Selecione...' || inicio !== '';

                if (isAtivo) {
                    estados.ativos[chaveAtiva] = {
                        conferente, doca, inicio,
                        fim: row.querySelector('input[data-field="fim"]').value,
                        obs
                    };
                } else if (obs !== 'Selecione...') {
                    estados.bloqueados[chaveBloqueada] = { obs };
                }
            }
        });
        return estados;
    }
    
    function atualizarStatusCor(placa, cliente, volumes, carretaNaDoca, inicio, fim, obs, statusCircle) {
        statusCircle.className = 'status-circle-table';
        const conferente = statusCircle.closest('tr').querySelector('select[data-field="conferente"]').value;
        const doca = statusCircle.closest('tr').querySelector('select[data-field="doca"]').value;
        const isLinhaVazia = !placa.trim() && !cliente.trim() && !volumes.trim();
        const isCarregamentoAtivo = conferente !== 'Selecione...' || doca !== 'Selecione...' || inicio !== '';
        if (isLinhaVazia || (obs !== 'Selecione...' && !isCarregamentoAtivo)) {
            statusCircle.classList.add('status-black');
            return;
        }
        if (!carretaNaDoca || !carretaNaDoca.includes(':')) {
            statusCircle.classList.add('status-white');
            return;
        }
        const dataBase = new Date('1970-01-01');
        const docaTime = new Date(`${dataBase.toDateString()} ${carretaNaDoca}`);
        if (inicio && fim) {
            let fimTime = new Date(`${dataBase.toDateString()} ${fim}`);
            if (fimTime < docaTime) fimTime.setDate(fimTime.getDate() + 1);
            const duracaoMinutos = (fimTime - docaTime) / 60000;
            if (duracaoMinutos <= 60) statusCircle.classList.add('status-blue');
            else statusCircle.classList.add('status-red');
        } else if (inicio) {
            const inicioTime = new Date(`${dataBase.toDateString()} ${inicio}`);
            if (inicioTime > docaTime) statusCircle.classList.add('status-yellow');
            else statusCircle.classList.add('status-green');
        } else {
            statusCircle.classList.add('status-white');
        }
    }

    function showBootstrapAlert(message, title = 'Aviso do Painel', type = 'primary') {
        const modalTitle = document.getElementById('alertModalLabel');
        const modalBody = document.getElementById('alertModalBody');
        const modalHeader = document.getElementById('alertModalHeader');
        modalTitle.textContent = title;
        modalBody.textContent = message;
        modalHeader.className = 'modal-header';
        if (type === 'success') modalHeader.classList.add('bg-success', 'text-white');
        else if (type === 'warning') modalHeader.classList.add('bg-warning', 'text-dark');
        else if (type === 'danger') modalHeader.classList.add('bg-danger', 'text-white');
        else if (type === 'info') modalHeader.classList.add('bg-info', 'text-white');
        alertModal.show();
    }

    function processRawData(rawData) {
        const estadoAnterior = salvarEstadoAtualDaTabela();
        try {
            const { cabecalho, dados } = parseData(rawData);
            renderizarTabela(dados, cabecalho, estadoAnterior);
            unsavedChanges = true;
            showBootstrapAlert('Dados atualizados! O estado anterior foi preservado. Lembre-se de salvar.', 'Atualização Concluída', 'info');
        } catch (error) {
            console.error('Erro ao processar dados:', error);
            showBootstrapAlert(`Erro ao processar os dados: ${error.message}`, 'Erro na Atualização', 'danger');
        }
    }

    function saveData() {
        const tableData = [];
        tabelaCorpo.querySelectorAll('tr').forEach(row => {
            const rowData = [];
            row.querySelectorAll('td').forEach(cell => {
                const input = cell.querySelector('input, select');
                rowData.push(input ? input.value : cell.textContent);
            });
            tableData.push(rowData);
        });
        localStorage.setItem(localStorageKey, JSON.stringify(tableData));
        unsavedChanges = false;
        showBootstrapAlert('Seus dados foram salvos com sucesso no navegador!', 'Dados Salvos', 'success');
    }

    function loadData() {
        const savedData = localStorage.getItem(localStorageKey);
        if (savedData) {
            const tableData = JSON.parse(savedData);
            renderizarTabelaFromSavedData(tableData);
        }
    }

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
            cabecalho = cabecalhoPadrao;
            dados = linhas;
        }
        return { cabecalho, dados };
    }

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
    
    function renderizarTabela(dados, cabecalho, estadoAnterior = { ativos: {}, bloqueados: {} }) {
        tabelaCorpo.innerHTML = '';
        if (!dados || dados.length === 0) return;

        const estadosAtivosParaAplicar = { ...(estadoAnterior.ativos || {}) };
        const estadosBloqueados = { ...(estadoAnterior.bloqueados || {}) };

        const conferentesOptionsHTML = listaDeConferentes.map(nome => `<option value="${nome}">${nome}</option>`).join('');
        const docasOptionsHTML = listaDeDocas.map(doca => `<option value="${doca}">${doca}</option>`).join('');
        const observacoesOptionsHTML = listaDeObservacoes.map(obs => `<option value="${obs}">${obs}</option>`).join('');

        dados.forEach(linha => {
            if (!linha.trim()) return;
            const colunas = parseCsvLine(linha);
            if (colunas.length < 5) return;
            const row = document.createElement('tr');

            const indiceCarretaNaDoca = cabecalho.findIndex(h => h.toLowerCase() === 'carreta na doca');
            const horaTexto = colunas[indiceCarretaNaDoca] || '';
            if (horaTexto.includes(':')) {
                const hora = parseInt(horaTexto.split(':')[0], 10);
                if ((hora >= 20 && hora <= 23) || (hora >= 0 && hora <= 4)) row.classList.add('turno-noturno');
                else if (hora >= 8 && hora <= 16) row.classList.add('turno-diurno');
            }
            
            const dataForCells = {};
            colunasDesejadas.forEach(nomeColuna => {
                const indice = cabecalho.findIndex(h => h.trim().toLowerCase() === nomeColuna.trim().toLowerCase());
                dataForCells[nomeColuna] = (indice !== -1 && colunas[indice]) ? colunas[indice].trim() : '';
            });

            let clienteEncurtado = dataForCells['Cliente'].split(' ').slice(0, 2).join(' ');
            const chaveAtiva = `${dataForCells['Placa']}-${clienteEncurtado}`;
            const chaveBloqueada = `${dataForCells['Placa']}-${clienteEncurtado}-${dataForCells['Janela']}`;
            
            let dadosSalvos = {};

            if (estadosAtivosParaAplicar[chaveAtiva]) {
                dadosSalvos = estadosAtivosParaAplicar[chaveAtiva];
                delete estadosAtivosParaAplicar[chaveAtiva];
            } 
            else if (estadosBloqueados[chaveBloqueada]) {
                dadosSalvos = estadosBloqueados[chaveBloqueada];
            }

            colunasDesejadas.forEach(nomeColuna => {
                const cell = document.createElement('td');
                let valor = dataForCells[nomeColuna];
                if (nomeColuna === 'Cliente') {
                    valor = clienteEncurtado;
                }
                cell.textContent = valor;
                row.appendChild(cell);
            });

            row.innerHTML += `
                <td><select class="form-select form-select-sm" data-field="conferente">${conferentesOptionsHTML}</select></td>
                <td><select class="form-select form-select-sm" data-field="doca">${docasOptionsHTML}</select></td>
                <td><input type="time" class="form-control form-control-sm" data-field="inicio"></td>
                <td><input type="time" class="form-control form-control-sm" data-field="fim"></td>
                <td><div class="status-circle-table"></div></td>
                <td><select class="form-select form-select-sm" data-field="obs">${observacoesOptionsHTML}</select></td>
            `;
            
            row.querySelector('select[data-field="conferente"]').value = dadosSalvos.conferente || 'Selecione...';
            row.querySelector('select[data-field="doca"]').value = dadosSalvos.doca || 'Selecione...';
            row.querySelector('input[data-field="inicio"]').value = dadosSalvos.inicio || '';
            row.querySelector('input[data-field="fim"]').value = dadosSalvos.fim || '';
            row.querySelector('select[data-field="obs"]').value = dadosSalvos.obs || 'Selecione...';
            
            tabelaCorpo.appendChild(row);
        });

        tabelaCorpo.querySelectorAll('tr').forEach(row => {
            gerenciarEstadoInputs(row);
            const placa = row.cells[2].textContent;
            const cliente = row.cells[3].textContent;
            const volumes = row.cells[4].textContent;
            const carretaNaDoca = row.cells[1].textContent;
            const inicio = row.querySelector('input[data-field="inicio"]').value;
            const fim = row.querySelector('input[data-field="fim"]').value;
            const obs = row.querySelector('select[data-field="obs"]').value;
            const statusCircle = row.querySelector('.status-circle-table');
            atualizarStatusCor(placa, cliente, volumes, carretaNaDoca, inicio, fim, obs, statusCircle);
        });
    }
    
    function renderizarTabelaFromSavedData(tableData) {
        tabelaCorpo.innerHTML = '';
        const conferentesOptionsHTML = listaDeConferentes.map(nome => `<option value="${nome}">${nome}</option>`).join('');
        const docasOptionsHTML = listaDeDocas.map(doca => `<option value="${doca}">${doca}</option>`).join('');
        const observacoesOptionsHTML = listaDeObservacoes.map(obs => `<option value="${obs}">${obs}</option>`).join('');

        tableData.forEach(rowData => {
            const row = document.createElement('tr');
            const horaTexto = rowData[1] || '';
            if (horaTexto.includes(':')) {
                const hora = parseInt(horaTexto.split(':')[0], 10);
                if ((hora >= 20 && hora <= 23) || (hora >= 0 && hora <= 4)) row.classList.add('turno-noturno');
                else if (hora >= 8 && hora <= 16) row.classList.add('turno-diurno');
            }
            
            for (let i = 0; i < 5; i++) {
                const cell = document.createElement('td');
                let valor = rowData[i] || '';
                if (i === 3) {
                    const palavras = valor.split(' ');
                    if (palavras.length > 2) {
                        valor = `${palavras[0]} ${palavras[1]}`;
                    }
                }
                cell.textContent = valor;
                row.appendChild(cell);
            }

            row.innerHTML += `
                <td><select class="form-select form-select-sm" data-field="conferente">${conferentesOptionsHTML}</select></td>
                <td><select class="form-select form-select-sm" data-field="doca">${docasOptionsHTML}</select></td>
                <td><input type="time" class="form-control form-control-sm" data-field="inicio" value="${rowData[7] || ''}"></td>
                <td><input type="time" class="form-control form-control-sm" data-field="fim" value="${rowData[8] || ''}"></td>
                <td><div class="status-circle-table"></div></td>
                <td><select class="form-select form-select-sm" data-field="obs">${observacoesOptionsHTML}</select></td>
            `;

            const selects = row.querySelectorAll('select');
            selects[0].value = rowData[5] || 'Selecione...';
            selects[1].value = rowData[6] || 'Selecione...';
            selects[2].value = rowData[10] || 'Selecione...';
            tabelaCorpo.appendChild(row);

            const placa = row.cells[2].textContent;
            const cliente = row.cells[3].textContent;
            const volumes = row.cells[4].textContent;
            const carretaNaDoca = row.cells[1].textContent;
            const inicio = row.querySelector('input[data-field="inicio"]').value;
            const fim = row.querySelector('input[data-field="fim"]').value;
            const obs = selects[2].value;
            const statusCircle = row.querySelector('.status-circle-table');

            gerenciarEstadoInputs(row);
            atualizarStatusCor(placa, cliente, volumes, carretaNaDoca, inicio, fim, obs, statusCircle);
        });
    }
});