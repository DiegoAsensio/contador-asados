document.addEventListener('DOMContentLoaded', function() {
  const ADMIN_PASSWORD = 'contraseña';
  const SHEETDB_URL = 'https://sheetdb.io/api/v1/6uuifj7mv9hc5';
  
  const AMIGOS = [
    'Diego',
    'Joaco',
    'Colo',
    'Cito',
    'Fede',
    'Gata',
    'Monti',
    'Nacho',
    'Cuca',
    'Choco'
  ].sort((a, b) => a.localeCompare(b, 'es'));
  
  const $ = sel => document.querySelector(sel);
  const today = () => new Date().toISOString().slice(0, 10);
  const genId = () => (window.crypto && typeof window.crypto.randomUUID === 'function' 
    ? window.crypto.randomUUID() 
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
  
  const formatDateDMY = (date) => {
    // Si la fecha es un número de Excel, convertirlo
    if (typeof date === 'number' || (date && !isNaN(date) && !String(date).includes('-'))) {
      const numDate = typeof date === 'string' ? parseFloat(date) : date;
      const excelEpoch = new Date(1899, 11, 30);
      const dateObj = new Date(excelEpoch.getTime() + numDate * 86400000);
      const d = String(dateObj.getDate()).padStart(2, '0');
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const y = dateObj.getFullYear();
      return `${d}/${m}/${y}`;
    }
    if (date && String(date).includes('-')) {
      const [y, m, d] = String(date).split('-');
      return `${d}/${m}/${y}`;
    }
    return date;
  };

  // Convierte cualquier formato de fecha a número comparable para ordenar
  // Soporta: número serial Excel (46029), string YYYY-MM-DD, string DD/MM/YYYY
  const dateToSortKey = (date) => {
    if (!date) return 0;
    // Número serial de Excel
    if (typeof date === 'number') return date;
    const s = String(date).trim();
    if (!isNaN(s) && !s.includes('-') && !s.includes('/')) return parseFloat(s);
    // YYYY-MM-DD → número YYYYMMDD comparable
    if (s.includes('-')) {
      const [y, m, d] = s.split('-');
      return parseInt(y) * 10000 + parseInt(m) * 100 + parseInt(d);
    }
    // DD/MM/YYYY → número YYYYMMDD comparable
    if (s.includes('/')) {
      const [d, m, y] = s.split('/');
      return parseInt(y) * 10000 + parseInt(m) * 100 + parseInt(d);
    }
    return 0;
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
        localStorage.setItem('juntadas-data', JSON.stringify(data));
        
        return data;
      } catch (error) {
        console.error('❌ Error leyendo de SheetDB:', error);
        try {
          const localData = JSON.parse(localStorage.getItem('juntadas-data') || '[]');
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
            titulo: row.titulo || 'Sin título',
            ubicacion: row.ubicacion || 'Sin ubicación',
            date: row.date,
            puntos: parseInt(row.puntos) || 1,
            sede: row.sede || '',
            asistentes: JSON.parse(row.asistentes || '[]'),
            bonusSede: row.bonusSede === 'true' || row.bonusSede === true
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
        
        const rows = data.map(juntada => ({
          id: juntada.id,
          titulo: juntada.titulo,
          ubicacion: juntada.ubicacion,
          date: juntada.date,
          puntos: juntada.puntos,
          sede: juntada.sede || '',
          asistentes: JSON.stringify(juntada.asistentes),
          bonusSede: juntada.bonusSede ? 'true' : 'false'
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
        
        localStorage.setItem('juntadas-data', JSON.stringify(data));
        return { success: true };
      } catch (error) {
        console.error('❌ Error guardando en SheetDB:', error);
        localStorage.setItem('juntadas-data', JSON.stringify(data));
        throw error;
      }
    }
  };
  
  let juntadas = [];
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
  
  function renderSedeOptions() {
    const sedeSelect = $('#sede');
    sedeSelect.innerHTML = '<option value="">Sin sede específica</option>' +
      AMIGOS.map(amigo => `<option value="${amigo}">${amigo}</option>`).join('');
  }
  
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
  
  function contarVecesComoSedeHasta(amigo, fechaLimite) {
    const juntadasOrdenadas = juntadas.slice().sort((a, b) => dateToSortKey(a.date) - dateToSortKey(b.date));
    
    let count = 0;
    for (const j of juntadasOrdenadas) {
      if (j.date === fechaLimite) break;
      if (j.sede === amigo) count++;
    }
    return count;
  }
  
  function contarVecesComoSede(amigo) {
    return juntadas.filter(j => j.sede === amigo).length;
  }
  
  function calcularBonusSede(amigo) {
    const vecesComoSede = contarVecesComoSede(amigo);
    return Math.floor(vecesComoSede / 3);
  }
  
  async function guardarJuntada() {
    const titulo = $('#titulo').value.trim();
    const ubicacion = $('#ubicacion').value.trim();
    const fecha = $('#fecha').value || today();
    const puntos = parseInt($('#puntos').value) || 1;
    const sede = $('#sede').value;
    const checkboxes = document.querySelectorAll('#amigos-list input[type="checkbox"]:checked');
    const asistentes = Array.from(checkboxes).map(cb => cb.value);
    
    if (!titulo) {
      alert('Ingresá un título para la juntada');
      return;
    }
    
    if (!ubicacion) {
      alert('Ingresá la ubicación de la juntada');
      return;
    }
    
    if (asistentes.length === 0) {
      alert('Seleccioná al menos un asistente');
      return;
    }
    
    try {
      console.log('💾 Guardando juntada...');
      
      let bonusSede = false;
      
      if (sede) {
        const vecesAnteriores = contarVecesComoSede(sede);
        if ((vecesAnteriores + 1) % 3 === 0) {
          bonusSede = true;
          console.log(`🎉 ${sede} recibe bonus por 3 veces como sede!`);
        }
      }
      
      const nuevaJuntada = {
        id: genId(),
        titulo: titulo,
        ubicacion: ubicacion,
        date: fecha,
        puntos: puntos,
        sede: sede,
        asistentes: asistentes,
        bonusSede: bonusSede
      };
      
      juntadas.push(nuevaJuntada);
      await store.write(juntadas);
      
      console.log('✅ Juntada guardada');
      
      if (bonusSede) {
        alert(`✅ Juntada registrada correctamente\n🎉 ${sede} recibió +1 punto bonus por ser sede 3 veces!`);
      } else {
        alert('✅ Juntada registrada correctamente');
      }
      
      limpiarFormulario();
      renderAll();
    } catch (error) {
      console.error('❌ Error guardando juntada:', error);
      alert('❌ Error al guardar. Revisá la consola.');
    }
  }
  
  function limpiarFormulario() {
    $('#titulo').value = '';
    $('#ubicacion').value = '';
    $('#fecha').value = today();
    $('#puntos').value = 1;
    $('#sede').value = '';
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
  
  $('#guardar-btn').addEventListener('click', guardarJuntada);
  $('#cancelar-btn').addEventListener('click', cancelarFormulario);
  
  // ==================== ESTADÍSTICAS ====================
  function calcularEstadisticas() {
    const totalJuntadas = juntadas.length;
    const totalPuntos = juntadas.reduce((sum, j) => sum + j.puntos, 0);
    const stats = new Map();
    
    AMIGOS.forEach(amigo => {
      stats.set(amigo, { nombre: amigo, asistencias: 0, puntos: 0, porcentaje: 0 });
    });
    
    juntadas.forEach(juntada => {
      juntada.asistentes.forEach(amigo => {
        const stat = stats.get(amigo);
        if (stat) {
          stat.asistencias++;
          stat.puntos += juntada.puntos;
        }
      });
    });
    
    AMIGOS.forEach(amigo => {
      const bonusTotal = calcularBonusSede(amigo);
      const stat = stats.get(amigo);
      if (stat && bonusTotal > 0) {
        stat.puntos += bonusTotal;
      }
    });
    
    stats.forEach((stat, amigo) => {
      stat.porcentaje = totalJuntadas > 0 
        ? Math.round((stat.asistencias / totalJuntadas) * 100) 
        : 0;
    });
    
    const promedioGeneral = totalJuntadas > 0
      ? Math.round((Array.from(stats.values()).reduce((sum, s) => sum + s.asistencias, 0) / (totalJuntadas * AMIGOS.length)) * 100)
      : 0;
    
    return {
      totalJuntadas,
      totalPuntos,
      promedioGeneral,
      ranking: Array.from(stats.values())
        .sort((a, b) => b.puntos - a.puntos || b.asistencias - a.asistencias || a.nombre.localeCompare(b.nombre, 'es'))
    };
  }
  
  function renderEstadisticas() {
    const stats = calcularEstadisticas();
    
    $('#total-juntadas').textContent = stats.totalJuntadas;
    $('#promedio-asistencia').textContent = stats.promedioGeneral + '%';
    $('#total-puntos').textContent = stats.totalPuntos;
  }
  
  function renderRanking() {
    const stats = calcularEstadisticas();
    const tbody = $('#tabla-ranking tbody');
    
    if (stats.ranking.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay datos todavía</td></tr>';
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
          <td><strong style="color:var(--good)">${stat.puntos}</strong></td>
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
    
    if (juntadas.length === 0) {
      container.innerHTML = '<p class="empty">No hay juntadas registradas todavía</p>';
      return;
    }
    
    // Orden cronológico inverso: más reciente arriba
    const sorted = juntadas.slice().sort((a, b) => dateToSortKey(b.date) - dateToSortKey(a.date));
    
    const items = sorted.map(juntada => {
      const deleteBtn = isAdminMode 
        ? `<button class="btn danger eliminar-btn" data-id="${juntada.id}" style="font-size:0.85rem;padding:8px 12px">Eliminar</button>` 
        : '';
      
      const puntosLabel = juntada.puntos > 1 
        ? `<span style="background:linear-gradient(135deg, #ff6b35, #06ffa5);padding:4px 10px;border-radius:999px;font-size:0.8rem;font-weight:700;color:#1a1a1a;margin-left:8px">${juntada.puntos} puntos</span>`
        : '';
      
      let bonusBadge = '';
      if (juntada.sede) {
        const vecesAntesDeEsta = contarVecesComoSedeHasta(juntada.sede, juntada.date);
        const vecesConEsta = vecesAntesDeEsta + 1;
        if (vecesConEsta % 3 === 0) {
          bonusBadge = `<span class="bonus-badge">✨ Bonus Sede +1 (${juntada.sede} llegó a ${vecesConEsta} veces)</span>`;
        }
      }
      
      const sedeInfo = juntada.sede 
        ? `<span class="muted" style="font-size:0.85rem;margin-left:12px">🏠 Sede: ${juntada.sede}</span>`
        : '';
      
      return `
        <div class="historial-item">
          <div class="historial-header">
            <div>
              <div class="historial-date">${juntada.titulo}${puntosLabel}${bonusBadge}</div>
              <div style="margin-top:4px">
                <span class="muted" style="font-size:0.85rem">📍 ${juntada.ubicacion}</span>
                <span class="muted" style="font-size:0.85rem;margin-left:12px">📅 ${formatDateDMY(juntada.date)}</span>
                ${sedeInfo}
              </div>
            </div>
            ${deleteBtn}
          </div>
          <div style="margin-top:8px">
            <span class="muted" style="font-size:0.85rem">Asistieron: ${juntada.asistentes.length} personas</span>
          </div>
          <div class="historial-asistentes">
            ${juntada.asistentes.map(a => `<span class="asistente-badge">${a}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Wrap en contenedor scrolleable
    container.innerHTML = `
      <div class="historial-wrapper">
        <div class="historial-scroll">
          ${items}
        </div>
      </div>
    `;
    
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
  
  async function eliminarJuntada(id) {
    try {
      console.log('🗑️ Eliminando juntada:', id);
      juntadas = juntadas.filter(j => j.id !== id);
      await store.write(juntadas);
      console.log('✅ Juntada eliminada');
      renderAll();
    } catch (error) {
      console.error('❌ Error eliminando juntada:', error);
      alert('Error al eliminar. Intentá de nuevo.');
    }
  }
  
  btnCancel.addEventListener('click', closeDeleteModal);
  btnConfirm.addEventListener('click', async () => {
    if (pendingDeleteId) {
      await eliminarJuntada(pendingDeleteId);
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
      juntadas = await store.read();
      const fechaInput = $('#fecha');
      if (fechaInput) {
        fechaInput.value = today();
      }
      renderSedeOptions();
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
      if (JSON.stringify(newData) !== JSON.stringify(juntadas)) {
        console.log('🔄 Cambios detectados, actualizando...');
        juntadas = newData;
        renderAll();
      }
    } catch (error) {
      console.error('❌ Error en auto-refresh:', error);
    }
  }, 30000);
  
  init();
});