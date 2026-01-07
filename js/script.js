document.addEventListener('DOMContentLoaded', function() {
  // ==================== CONFIGURACIÓN ====================
  const ADMIN_PASSWORD = 'asado';
  const SHEETDB_URL = 'https://sheetdb.io/api/v1/6uuifj7mv9hc5';
  
  // Lista de amigos - Agregá o quitá según necesites
  const AMIGOS = [
    'Diego',
    'Joaco',
    'Colo',
    'Cito',
    'Fede',
    'Gata',
    'Monti',
    'Nacho'
  ].sort((a, b) => a.localeCompare(b, 'es'));
  
  const $ = sel => document.querySelector(sel);
  const today = () => new Date().toISOString().slice(0, 10);
  const genId = () => (window.crypto && typeof window.crypto.randomUUID === 'function' 
    ? window.crypto.randomUUID() 
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
  
  const formatDateDMY = (date) => {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  };
  
  const store = {
    async read() {
      try {
        console.log('📡 Leyendo datos de SheetDB...');
        
        const response = await fetch(SHEETDB_URL, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rows = await response.json();
        console.log('✅ Datos leídos:', rows.length, 'filas');
        
        const data = this.parseSheetData(rows);
        localStorage.setItem('asados-data', JSON.stringify(data));
        
        return data;
      } catch (error) {
        console.error('❌ Error leyendo de SheetDB:', error);
        try {
          const localData = JSON.parse(localStorage.getItem('asados-data') || '[]');
          console.log('📦 Usando datos de localStorage como fallback');
          return localData;
        } catch (e) {
          console.error('❌ Error leyendo localStorage:', e);
          return [];
        }
      }
    },
    
    parseSheetData(rows) {
      return rows.map(row => {
        try {
          return {
            id: row.id || genId(),
            date: row.date,
            asistentes: JSON.parse(row.asistentes || '[]')
          };
        } catch (e) {
          console.error('Error parseando fila:', row, e);
          return null;
        }
      }).filter(m => m !== null);
    },
    
    async write(data) {
      try {
        console.log('💾 Guardando datos en SheetDB...');
        
        const rows = data.map(asado => ({
          id: asado.id,
          date: asado.date,
          asistentes: JSON.stringify(asado.asistentes)
        }));
        
        await fetch(SHEETDB_URL + '/all', { method: 'DELETE' });
        
        if (rows.length > 0) {
          const response = await fetch(SHEETDB_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rows)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
          }
          
          console.log('✅ Guardado exitoso');
        }
        
        localStorage.setItem('asados-data', JSON.stringify(data));
        return { success: true };
      } catch (error) {
        console.error('❌ Error guardando en SheetDB:', error);
        localStorage.setItem('asados-data', JSON.stringify(data));
        throw error;
      }
    }
  };
  
  let asados = [];
  let isAdminMode = false;
  
  const authCard = $('#auth-card');
  const formCard = $('#form-card');
  const passwordInput = $('#admin-password');
  const authBtn = $('#auth-btn');
  const authError = $('#auth-error');
  
  function checkAuth() {
    if (isAdminMode) {
      authCard.style.display = 'none';
      formCard.style.display = 'block';
    } else {
      authCard.style.display = 'block';
      formCard.style.display = 'none';
    }
  }
  
  function attemptLogin() {
    const password = passwordInput.value.trim();
    if (password === ADMIN_PASSWORD) {
      isAdminMode = true;
      passwordInput.value = '';
      authError.style.display = 'none';
      checkAuth();
      renderHistorial();
    } else {
      authError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
      setTimeout(() => {
        authError.style.display = 'none';
      }, 3000);
    }
  }
  
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });
  
  authBtn.addEventListener('click', attemptLogin);
  
  function renderAmigosList() {
    const container = $('#amigos-list');
    container.innerHTML = AMIGOS.map(amigo => `
      <div class="amigo-checkbox" data-amigo="${amigo}">
        <input type="checkbox" id="amigo-${amigo}" value="${amigo}">
        <label for="amigo-${amigo}">${amigo}</label>
      </div>
    `).join('');
    
    container.querySelectorAll('.amigo-checkbox').forEach(div => {
      const checkbox = div.querySelector('input');
      div.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          checkbox.checked = !checkbox.checked;
        }
        div.classList.toggle('selected', checkbox.checked);
      });
      
      checkbox.addEventListener('change', () => {
        div.classList.toggle('selected', checkbox.checked);
      });
    });
  }
  
  async function guardarAsado() {
    const fecha = $('#fecha').value || today();
    const checkboxes = document.querySelectorAll('#amigos-list input[type="checkbox"]:checked');
    const asistentes = Array.from(checkboxes).map(cb => cb.value);
    
    if (asistentes.length === 0) {
      alert('Seleccioná al menos un asistente');
      return;
    }
    
    try {
      console.log('💾 Guardando asado...');
      
      const nuevoAsado = {
        id: genId(),
        date: fecha,
        asistentes: asistentes
      };
      
      asados.push(nuevoAsado);
      await store.write(asados);
      
      console.log('✅ Asado guardado');
      alert('✅ Asado registrado correctamente');
      
      limpiarFormulario();
      renderAll();
    } catch (error) {
      console.error('❌ Error guardando asado:', error);
      alert('❌ Error al guardar. Revisá la consola.');
    }
  }
  
  function limpiarFormulario() {
    $('#fecha').value = today();
    document.querySelectorAll('#amigos-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.closest('.amigo-checkbox').classList.remove('selected');
    });
  }
  
  function cancelarFormulario() {
    isAdminMode = false;
    limpiarFormulario();
    checkAuth();
  }
  
  $('#guardar-btn').addEventListener('click', guardarAsado);
  $('#cancelar-btn').addEventListener('click', cancelarFormulario);
  
  // ==================== ESTADÍSTICAS ====================
  function calcularEstadisticas() {
    const totalAsados = asados.length;
    const stats = new Map();
    
    AMIGOS.forEach(amigo => {
      stats.set(amigo, { nombre: amigo, asistencias: 0, porcentaje: 0 });
    });
    
    asados.forEach(asado => {
      asado.asistentes.forEach(amigo => {
        const stat = stats.get(amigo);
        if (stat) stat.asistencias++;
      });
    });
    
    stats.forEach((stat, amigo) => {
      stat.porcentaje = totalAsados > 0 
        ? Math.round((stat.asistencias / totalAsados) * 100) 
        : 0;
    });
    
    const promedioGeneral = totalAsados > 0
      ? Math.round((Array.from(stats.values()).reduce((sum, s) => sum + s.asistencias, 0) / (totalAsados * AMIGOS.length)) * 100)
      : 0;
    
    return {
      totalAsados,
      promedioGeneral,
      ranking: Array.from(stats.values())
        .sort((a, b) => b.asistencias - a.asistencias || a.nombre.localeCompare(b.nombre, 'es'))
    };
  }
  
  function renderEstadisticas() {
    const stats = calcularEstadisticas();
    
    $('#total-asados').textContent = stats.totalAsados;
    $('#promedio-asistencia').textContent = stats.promedioGeneral + '%';
  }
  
  function renderRanking() {
    const stats = calcularEstadisticas();
    const tbody = $('#tabla-ranking tbody');
    
    if (stats.ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No hay datos todavía</td></tr>';
      return;
    }
    
    tbody.innerHTML = stats.ranking.map((stat, index) => {
      let badge = '';
      if (index === 0) badge = '<span class="ranking-badge first">🥇</span>';
      else if (index === 1) badge = '<span class="ranking-badge second">🥈</span>';
      else if (index === 2) badge = '<span class="ranking-badge third">🥉</span>';
      else badge = `<span class="ranking-badge other">${index + 1}</span>`;
      
      return `
        <tr>
          <td>${badge}</td>
          <td><strong>${stat.nombre}</strong></td>
          <td>${stat.asistencias}</td>
          <td>
            <strong>${stat.porcentaje}%</strong>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${stat.porcentaje}%"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  function renderHistorial() {
    const container = $('#historial');
    
    if (asados.length === 0) {
      container.innerHTML = '<p class="empty">No hay asados registrados todavía</p>';
      return;
    }
    
    const sorted = asados.slice().sort((a, b) => a.date < b.date ? 1 : -1);
    
    container.innerHTML = sorted.map(asado => {
      const deleteBtn = isAdminMode 
        ? `<button class="btn danger eliminar-btn" data-id="${asado.id}" style="font-size:0.85rem;padding:8px 12px">Eliminar</button>` 
        : '';
      
      return `
        <div class="historial-item">
          <div class="historial-header">
            <div class="historial-date">📅 ${formatDateDMY(asado.date)}</div>
            ${deleteBtn}
          </div>
          <div style="margin-top:8px">
            <span class="muted" style="font-size:0.85rem">Asistieron: ${asado.asistentes.length} personas</span>
          </div>
          <div class="historial-asistentes">
            ${asado.asistentes.map(a => `<span class="asistente-badge">${a}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');
    
    if (isAdminMode) {
      document.querySelectorAll('.eliminar-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
      });
    }
  }
  
  let pendingDeleteId = null;
  const modal = $('#deleteModal');
  const btnCancel = $('#cancelDelete');
  const btnConfirm = $('#confirmDelete');
  
  function openDeleteModal(id) {
    pendingDeleteId = id;
    modal.classList.add('show');
  }
  
  function closeDeleteModal() {
    pendingDeleteId = null;
    modal.classList.remove('show');
  }
  
  async function eliminarAsado(id) {
    try {
      console.log('🗑️ Eliminando asado:', id);
      asados = asados.filter(a => a.id !== id);
      await store.write(asados);
      console.log('✅ Asado eliminado');
      renderAll();
    } catch (error) {
      console.error('❌ Error eliminando asado:', error);
      alert('Error al eliminar. Intentá de nuevo.');
    }
  }
  
  btnCancel.addEventListener('click', closeDeleteModal);
  btnConfirm.addEventListener('click', async () => {
    if (pendingDeleteId) {
      await eliminarAsado(pendingDeleteId);
    }
    closeDeleteModal();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDeleteModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDeleteModal();
  });
  
  function renderAll() {
    renderEstadisticas();
    renderRanking();
    renderHistorial();
  }
  
  async function init() {
    try {
      console.log('🚀 Iniciando aplicación...');
      asados = await store.read();
      $('#fecha').value = today();
      renderAmigosList();
      checkAuth();
      renderAll();
      console.log('✅ Aplicación lista');
    } catch (error) {
      console.error('❌ Error crítico:', error);
    }
  }
  
  setInterval(async () => {
    try {
      const newData = await store.read();
      if (JSON.stringify(newData) !== JSON.stringify(asados)) {
        console.log('🔄 Cambios detectados, actualizando...');
        asados = newData;
        renderAll();
        }
        } catch (error) {
        console.error('❌ Error en auto-refresh:', error);
        }
       }, 30000);
    init();
});