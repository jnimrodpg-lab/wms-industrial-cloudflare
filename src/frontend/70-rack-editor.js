  function resetRackPreviewCamera(){
    if(!appState.ui) appState.ui = {};
    appState.ui.rackPreviewCamera = null;
  }


  function rerenderRackEditorPreservingState(options = {}){
    const main = document.querySelector('.rack-models-main');
    const list = document.getElementById('modelsList');
    const mainScroll = main ? main.scrollTop : 0;
    const listScroll = list ? list.scrollTop : 0;

    renderModelsList();
    renderRackModelPreview();
    if(window.contentFootRight) contentFootRight.textContent = `${appState.models.length} modelos`;

    requestAnimationFrame(() => {
      const nextMain = document.querySelector('.rack-models-main');
      const nextList = document.getElementById('modelsList');
      if(nextMain){
        const maxMainScroll = Math.max(0, nextMain.scrollHeight - nextMain.clientHeight);
        nextMain.scrollTop = Math.min(Math.max(0, mainScroll), maxMainScroll);
      }
      if(nextList){
        const maxListScroll = Math.max(0, nextList.scrollHeight - nextList.clientHeight);
        nextList.scrollTop = Math.min(Math.max(0, listScroll), maxListScroll);
      }
    });
  }

  async function switchViewerBranch(branchIndex){
    const index = Number(branchIndex);
    if(!Number.isFinite(index)) return;
    await activateBranchSelection(index);
    loadLayoutForBranch(index);
    if(Array.isArray(appState.filtered) && appState.filtered.length){
      const preferred = appState.selectedProduct && appState.filtered.find(p => p.sku === appState.selectedProduct.sku && p.ubicacion === appState.selectedProduct.ubicacion);
      appState.selectedProduct = preferred || appState.filtered[0];
      appState.selectedRack = appState.selectedProduct?.rack || appState.selectedProduct?.rackStore || ''; 
      appState.selectedRackLayoutId = appState.selectedRack;
    } else {
      appState.selectedProduct = null;
      appState.selectedRack = appState.layout?.racks?.[0]?.id || ''; 
      appState.selectedRackLayoutId = appState.selectedRack;
    }
    renderProducts(appState.filtered || []);
    renderMapView();
  }

  function renderRackModels(){
    if(!(appState.history?.racks?.undoStack?.length)) recordHistorySnapshot('racks');
    const previousScreen = appState.screen;
    appState.screen = 'racks';
    if(previousScreen !== 'racks') resetRackPreviewCamera();
    contentTitle.textContent = 'Edición de Rack';
    contentSubtitle.textContent = 'Diseña modelos reutilizables de rack, sus niveles y su preview técnico.';
    detailTitle.textContent = 'Preview del modelo';
    detailSubtitle.textContent = 'Arrastra para mover y usa la rueda para acercar o alejar.';
    setTags([
      { label:'↶ Undo', active:true, action:'history-undo-racks', extraClass:'history-chip' },
      { label:'↷ Redo', active:true, action:'history-redo-racks', extraClass:'history-chip' },
      'modelos', 'niveles', 'preview', 'biblioteca'
    ]);

    if (!Array.isArray(appState.models) || !appState.models.length){
      appState.models = [
        { id:'std_4', name:'Rack estándar 4 niveles', levels:4, width:120, depth:40, height:240, clearance:0, style:'metallic', slots:2, beam:2 },
        { id:'wide_5', name:'Rack ancho 5 niveles', levels:5, width:172, depth:90, height:270, clearance:0, style:'wide', slots:2, beam:2 },
        { id:'compact_3', name:'Rack compacto 3 niveles', levels:3, width:132, depth:76, height:200, clearance:0, style:'melamine', slots:2, beam:2 }
      ];
      saveRackModels();
    }
    if (!Array.isArray(appState.ui.rackLibraryOpenIds)) appState.ui.rackLibraryOpenIds = [];
    if (!Array.isArray(appState.ui.rackLibraryLevelsOpenIds)) appState.ui.rackLibraryLevelsOpenIds = [];
    if (!appState.selectedModelId || !appState.models.some(m => m.id === appState.selectedModelId)){
      appState.selectedModelId = appState.models[0].id;
    }
    
    const active = rackModel(appState.selectedModelId) || appState.models[0];

    contentWrap.innerHTML = `
      <div class="rack-models-page">
        <div class="rack-models-main">
          <section class="rack-block">
            <div class="rack-block-head">
              <div>
                <h3>Acciones del modelo</h3>
                <div class="rack-block-sub">Selecciona un modelo desde la biblioteca y edítalo directamente ahí. Los cambios afectan el preview en tiempo real.</div>
              </div>
              <div class="tag-row">
                <span class="tag">Modelo activo</span>
                <span class="tag">${escapeHtml(active?.name || '')}</span>
              </div>
            </div>
            <div class="model-actions">
              <button class="btn" id="btnSaveModel">Guardar modelo</button>
              <button class="btn alt" id="btnNewModel">Nuevo modelo</button>
              <button class="btn alt" id="btnDuplicateModel">Duplicar modelo</button>
              <button class="btn alt" id="btnDeleteModel">Eliminar modelo</button>
            </div>
          </section>

          <section class="rack-block rack-library-editor-block">
            <div class="rack-block-head">
              <div>
                <h3>Biblioteca de modelos</h3>
                <div class="rack-block-sub">Cada modelo tiene su propio editor y su editor de niveles dentro del acordeón.</div>
              </div>
              <div class="tag-row">
                <span class="tag">${appState.models.length} modelos</span>
                <span class="tag">Editor integrado</span>
              </div>
            </div>
            <div id="modelsList" class="model-library library-list model-library-scroll library-master"></div>
          </section>
        </div>

        <aside class="rack-models-side">
          <section class="rack-block preview-box-3d">
            <div class="rack-block-head">
              <div>
                <h3>Preview del modelo</h3>
                <div class="rack-block-sub">Vista grande y centrada para revisar la estructura del modelo activo.</div>
              </div>
            </div>
            <div class="detail-stage is-navigable" id="rackPreviewStage"><svg id="rackModelSvg" viewBox="0 0 520 480"></svg></div>
          </section>
        </aside>
      </div>`;

    detailWrap.innerHTML = '';
    const saveBtn = $('#btnSaveModel');
    if (saveBtn) saveBtn.onclick = saveRackModel;
    if ($('#btnNewModel')) $('#btnNewModel').onclick = createNewRackModelDraft;
    if ($('#btnDuplicateModel')) $('#btnDuplicateModel').onclick = () => duplicateRackModel(appState.selectedModelId);
    if ($('#btnDeleteModel')) $('#btnDeleteModel').onclick = () => deleteRackModel(appState.selectedModelId);
    const undoRackBtn = document.querySelector('[data-history-undo="racks"]'); if(undoRackBtn) undoRackBtn.onclick = () => undoHistory('racks');
    const redoRackBtn = document.querySelector('[data-history-redo="racks"]'); if(redoRackBtn) redoRackBtn.onclick = () => redoHistory('racks');

    renderModelsList();
    renderRackModelPreview();
    updateUndoRedoUi();
    contentStatus.textContent = 'Modo activo: EDICIÓN DE RACK • biblioteca editable, niveles integrados y preview técnico.';
    contentFootRight.textContent = `${appState.models.length} modelos`;
  }

  function renderModelsList(){
    const mount = $('#modelsList');
    if (!mount) return;
    if (!Array.isArray(appState.models)) appState.models = [];
    if (!Array.isArray(appState.ui.rackLibraryOpenIds)) appState.ui.rackLibraryOpenIds = [];
    if (!Array.isArray(appState.ui.rackLibraryLevelsOpenIds)) appState.ui.rackLibraryLevelsOpenIds = [];
    mount.className = 'model-library library-list model-library-scroll';
    const orderedModels = [...appState.models];
    mount.innerHTML = orderedModels.map(m => {
      const open = appState.ui.rackLibraryOpenIds.includes(m.id);
      const levelsOpen = appState.ui.rackLibraryLevelsOpenIds.includes(m.id);
      const levelHeights = buildLevelHeights(m);
      return `
      <div class="library-item ${m.id===appState.selectedModelId?'active':''} ${open?'open':''}" data-mid="${m.id}">
        <div class="library-item-head" data-library-toggle="${m.id}">
          <div class="library-item-left">
            <div class="library-item-title">${escapeHtml(m.name)}</div>
            <div class="library-item-sub">${rackStyleSub(m.style)}</div>
          </div>
          <div class="library-inline-meta">
            <span class="library-inline-pill">${m.levels} niveles</span>
            <span class="library-inline-pill">${m.width}×${m.depth}×${m.height} cm</span>
          </div>
          <span class="tag">${rackStyleLabel(m.style)}</span>
          <button class="library-toggle" type="button" data-library-toggle-btn="${m.id}" aria-label="${open?'Minimizar modelo':'Desplegar modelo'}">${open?'−':'+'}</button>
        </div>
        ${open ? `
        <div class="library-item-body">
          <div class="model-inline-grid-2">
            <div>
              <label class="field-label">Nombre del modelo</label>
              <input data-model-input="name" data-mid="${m.id}" value="${escapeHtml(m.name)}" />
            </div>
            <div>
              <label class="field-label">Tipo</label>
              <select data-model-input="style" data-mid="${m.id}">
                <option value="metallic" ${normalizeRackStyle(m.style)==='metallic'?'selected':''}>Metálico</option>
                <option value="melamine" ${normalizeRackStyle(m.style)==='melamine'?'selected':''}>Melamina</option>
                <option value="under_stairs" ${normalizeRackStyle(m.style)==='under_stairs'?'selected':''}>Bajo escalera</option>
                <option value="under_stairs_reflected" ${normalizeRackStyle(m.style)==='under_stairs_reflected'?'selected':''}>Bajo escalera reflejado</option>
              </select>
            </div>
          </div>
          ${isUnderStairsStyle(m.style) ? `
          <div style="display:grid;gap:12px;margin-top:4px">
            <div style="padding:12px;border:1px solid rgba(212,170,64,.24);border-radius:12px;background:rgba(9,21,36,.45)">
              <div class="tiny muted" style="margin-bottom:8px;font-weight:700;letter-spacing:.02em">DIMENSIONES GENERALES</div>
              <div class="model-inline-grid-4">
                <div><label class="field-label">Largo (cm)</label><input type="number" min="30" step="1" data-model-input="width" data-mid="${m.id}" value="${m.width}" /></div>
                <div><label class="field-label">Ancho (cm)</label><input type="number" min="20" step="1" data-model-input="depth" data-mid="${m.id}" value="${m.depth}" /></div>
                <div><label class="field-label">Alto total (cm)</label><input type="number" min="60" step="1" data-model-input="height" data-mid="${m.id}" value="${m.height}" /></div>
                <div><label class="field-label">Altura desde el piso (cm)</label><input type="number" min="0" max="120" step="1" data-model-input="clearance" data-mid="${m.id}" value="${m.clearance || 0}" /></div>
              </div>
            </div>
            <div style="padding:12px;border:1px solid rgba(212,170,64,.24);border-radius:12px;background:rgba(9,21,36,.45)">
              <div class="tiny muted" style="margin-bottom:8px;font-weight:700;letter-spacing:.02em">ALTURAS Y PENDIENTE</div>
              <div class="model-inline-grid-3" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
                <div><label class="field-label">Altura lateral 1 (cm)</label><input type="number" min="40" step="1" data-model-input="leftHeight" data-mid="${m.id}" value="${Math.round(Number(m.leftHeight || m.height || 240))}" /></div>
                <div><label class="field-label">Altura lateral 2 (cm)</label><input type="number" min="20" step="1" data-model-input="rightHeight" data-mid="${m.id}" value="${Math.round(Number(m.rightHeight || Math.max(40, (m.height||240)*0.35)))}" /></div>
                <div><label class="field-label">Largo top (cm)</label><input type="number" min="8" step="1" data-model-input="topLength" data-mid="${m.id}" value="${Math.round(Number(m.topLength || Math.max(8, Math.min((m.width||180)-8, (m.width||180)*0.33))))}" /></div>
              </div>
              <div class="tiny muted" style="margin-top:8px">El largo top crea un techo horizontal antes de iniciar la pendiente hacia el lateral opuesto.</div>
            </div>
            <div style="padding:12px;border:1px solid rgba(212,170,64,.24);border-radius:12px;background:rgba(9,21,36,.45)">
              <div class="tiny muted" style="margin-bottom:8px;font-weight:700;letter-spacing:.02em">CONFIGURACIÓN DE NIVELES</div>
              <div class="model-inline-grid-4">
                <div><label class="field-label">Niveles</label><input type="number" min="2" max="12" step="1" data-model-input="levels" data-mid="${m.id}" value="${m.levels}" /></div>
                <div><label class="field-label">Slots por nivel</label><input type="number" min="1" max="6" step="1" data-model-input="slots" data-mid="${m.id}" value="${m.slots || m.capacity || 2}" /></div>
                <div></div>
                <div class="library-inline-actions-box"><button class="mini-btn" data-level-toggle="${m.id}">${levelsOpen?'Ocultar niveles':'Editar niveles'}</button></div>
              </div>
            </div>
          </div>` : `
          <div style="display:grid;gap:12px;margin-top:4px">
            <div style="padding:12px;border:1px solid rgba(212,170,64,.24);border-radius:12px;background:rgba(9,21,36,.45)">
              <div class="tiny muted" style="margin-bottom:8px;font-weight:700;letter-spacing:.02em">DIMENSIONES GENERALES</div>
              <div class="model-inline-grid-4">
                <div><label class="field-label">Largo (cm)</label><input type="number" min="30" step="1" data-model-input="width" data-mid="${m.id}" value="${m.width}" /></div>
                <div><label class="field-label">Ancho (cm)</label><input type="number" min="20" step="1" data-model-input="depth" data-mid="${m.id}" value="${m.depth}" /></div>
                <div><label class="field-label">Alto total (cm)</label><input type="number" min="60" step="1" data-model-input="height" data-mid="${m.id}" value="${m.height}" /></div>
                <div><label class="field-label">Altura desde el piso (cm)</label><input type="number" min="0" max="120" step="1" data-model-input="clearance" data-mid="${m.id}" value="${m.clearance || 0}" /></div>
              </div>
            </div>
            <div style="padding:12px;border:1px solid rgba(212,170,64,.24);border-radius:12px;background:rgba(9,21,36,.45)">
              <div class="tiny muted" style="margin-bottom:8px;font-weight:700;letter-spacing:.02em">CONFIGURACIÓN DE NIVELES</div>
              <div class="model-inline-grid-4">
                <div><label class="field-label">Niveles</label><input type="number" min="2" max="12" step="1" data-model-input="levels" data-mid="${m.id}" value="${m.levels}" /></div>
                <div><label class="field-label">Slots por nivel</label><input type="number" min="1" max="6" step="1" data-model-input="slots" data-mid="${m.id}" value="${m.slots || m.capacity || 2}" /></div>
                <div></div>
                <div class="library-inline-actions-box"><button class="mini-btn" data-level-toggle="${m.id}">${levelsOpen?'Ocultar niveles':'Editar niveles'}</button></div>
              </div>
            </div>
          </div>`}

          ${levelsOpen ? `
          <div class="library-levels-panel open" data-level-panel="${m.id}">
            <div class="level-editor-tools inline-level-tools">
              <span class="tag">${levelHeights.length} niveles</span>
              <button class="mini-btn" data-model-auto-levels="${m.id}">Auto distribuir</button>
            </div>
            <div class="level-editor-list embedded-level-list">
              ${Array.from({length: levelHeights.length}, (_, displayPos) => {
                const idx = levelHeights.length - 1 - displayPos;
                const value = levelHeights[idx];
                const displayLevel = idx + 1;
                return `
                <div class="level-row compact">
                  <strong>Nivel ${displayLevel}</strong>
                  <input type="number" min="10" step="1" value="${value}" data-level-height-model="${m.id}" data-level-height-index="${idx}" />
                  <div class="level-slot-inline">
                    <label>Slots</label>
                    <input type="number" min="1" max="6" step="1" value="${Math.max(1, Math.min(6, buildLevelSlots(m)[idx] || Math.max(1, Number(m.slots||2)||2)))}" data-level-slot-model="${m.id}" data-level-slot-index="${idx}" />
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>` : ''}
          <div class="model-card-actions">
            <button class="mini-btn" data-model-action="duplicate" data-mid="${m.id}">Duplicar</button>
            <button class="mini-btn" data-model-action="delete" data-mid="${m.id}">Eliminar</button>
            <button class="mini-btn" data-model-action="use" data-mid="${m.id}">Activar</button>
          </div>
        </div>` : ''}
      </div>`;
    }).join('');

    $$('[data-library-toggle]').forEach(head => head.onclick = (e) => {
      if(e.target.closest('[data-library-toggle-btn]')) return;
      const id = head.getAttribute('data-library-toggle');
      const changed = appState.selectedModelId !== id;
      appState.selectedModelId = id;
      if(changed) resetRackPreviewCamera();
      appState.ui.rackLibraryOpenIds = [id];
      rerenderRackEditorPreservingState({ focusId:id });
    });

    $$('[data-library-toggle-btn]').forEach(btn => {
      const toggleModelCard = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-library-toggle-btn');
        const openIds = Array.isArray(appState.ui.rackLibraryOpenIds) ? [...appState.ui.rackLibraryOpenIds] : [];
        const isOpen = openIds.includes(id);
        appState.ui.rackLibraryOpenIds = isOpen ? openIds.filter(x => x !== id) : [id];
        if(isOpen){
          appState.ui.rackLibraryLevelsOpenIds = appState.ui.rackLibraryLevelsOpenIds.filter(x => x !== id);
        }
        if(!isOpen && appState.selectedModelId !== id){
          appState.selectedModelId = id;
          resetRackPreviewCamera();
        }
        rerenderRackEditorPreservingState({ focusId:id });
      };
      btn.onclick = toggleModelCard;
      btn.onpointerdown = (e) => { e.stopPropagation(); };
    });

    $$('[data-model-input]').forEach(el => {
      const handler = () => updateRackModelField(
        el.getAttribute('data-mid'),
        el.getAttribute('data-model-input'),
        el.type === 'checkbox' ? !!el.checked : el.value
      );
      if(el.type === 'checkbox') el.onchange = handler;
      else {
        el.oninput = handler;
        if(el.tagName === 'SELECT') el.onchange = handler;
      }
    });

    $$('[data-level-toggle]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.getAttribute('data-level-toggle');
      const open = appState.ui.rackLibraryLevelsOpenIds.includes(id);
      const changed = appState.selectedModelId !== id;
      appState.selectedModelId = id;
      if(changed) resetRackPreviewCamera();
      appState.ui.rackLibraryLevelsOpenIds = open ? appState.ui.rackLibraryLevelsOpenIds.filter(x => x!==id) : [...appState.ui.rackLibraryLevelsOpenIds.filter(x => x!==id), id];
      rerenderRackEditorPreservingState({ focusId:id });
    });

    $$('[data-level-height-model]').forEach(inp => inp.oninput = () => {
      const id = inp.getAttribute('data-level-height-model');
      const idx = Number(inp.getAttribute('data-level-height-index') || 0);
      const model = rackModel(id);
      if(!model) return;
      const heights = buildLevelHeights(model);
      heights[idx] = Math.max(10, Number(inp.value || 10) || 10);
      model.levelHeights = heights;
      appState.selectedModelId = id;
      renderRackModelPreview();
    });
    $$('[data-level-slot-model]').forEach(inp => {
      const applyValue = (nextValue) => {
        const id = inp.getAttribute('data-level-slot-model');
        const idx = Number(inp.getAttribute('data-level-slot-index') || 0);
        const model = rackModel(id);
        if(!model) return;
        const slots = buildLevelSlots(model);
        const current = Number(nextValue ?? inp.value);
        slots[idx] = Math.max(1, Math.min(6, current || 1));
        model.levelSlots = slots;
        model.slots = Math.max(...slots);
        appState.selectedModelId = id;
        rerenderRackEditorPreservingState({ focusId:id });
      };
      inp.oninput = () => applyValue();
      inp.onchange = () => applyValue();
    });

    $$('[data-level-slot-step]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-level-slot-model');
      const idx = Number(btn.getAttribute('data-level-slot-index') || 0);
      const step = Number(btn.getAttribute('data-level-slot-step') || 0) || 0;
      const model = rackModel(id);
      if(!model) return;
      const slots = buildLevelSlots(model);
      slots[idx] = Math.max(1, Math.min(6, (Number(slots[idx] || model.slots || 2) || 2) + step));
      model.levelSlots = slots;
      model.slots = Math.max(...slots);
      appState.selectedModelId = id;
      rerenderRackEditorPreservingState({ focusId:id });
    });

    $$('[data-model-auto-levels]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      autoDistributeLevels(btn.getAttribute('data-model-auto-levels'));
    });

    $$('[data-model-action]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-mid');
      const action = btn.getAttribute('data-model-action');
      if(action === 'duplicate') duplicateRackModel(id);
      else if(action === 'delete') deleteRackModel(id);
      else if(action === 'use'){ const changed = appState.selectedModelId !== id; appState.selectedModelId = id; if(changed) resetRackPreviewCamera(); rerenderRackEditorPreservingState({ focusId:id }); }
    });
  }

  function buildLevelHeights(model){
    const count = Math.max(2, Math.min(12, Number(model?.levels || 4) || 4));
    const stored = Array.isArray(model?.levelHeights) ? model.levelHeights.map(v => Math.max(10, Number(v)||10)) : [];
    if (stored.length === count) return stored;
    const usable = Math.max(20, (Number(model?.height || 238) || 238) - (Number(model?.clearance || 0) || 0));
    const each = Math.max(10, Math.round((usable / count) * 10) / 10);
    return Array.from({length: count}, () => each);
  }
  function buildLevelSlots(model){
    const count = Math.max(2, Math.min(12, Number(model?.levels || 4) || 4));
    const fallback = Math.max(1, Math.min(6, Number(model?.slots || model?.capacity || 2) || 2));
    const stored = Array.isArray(model?.levelSlots) ? model.levelSlots.map(v => Math.max(1, Math.min(6, Number(v)||fallback))) : [];
    if (stored.length === count) return stored;
    return Array.from({length: count}, (_, idx) => stored[idx] || fallback);
  }
  function getRackCapacity(model){
    const levelSlots = buildLevelSlots(model || {});
    return Math.max(1, levelSlots.reduce((sum, v) => sum + Math.max(1, Number(v)||0), 0));
  }

  function normalizeRackStyle(style){
    const raw = String(style || '').toLowerCase();
    if(raw === 'melamine' || raw === 'melamina' || raw === 'compact') return 'melamine';
    if(raw === 'under_stairs_reflected' || raw === 'bajo_escalera_reflejado' || raw === 'bajo escalera reflejado' || raw === 'under stairs reflected') return 'under_stairs_reflected';
    if(raw === 'under_stairs' || raw === 'bajo_escalera' || raw === 'bajo escalera') return 'under_stairs';
    return 'metallic';
  }
  function rackStyleLabel(style){
    const normalized = normalizeRackStyle(style);
    if(normalized === 'melamine') return 'Melamina';
    if(normalized === 'under_stairs_reflected') return 'Bajo escalera reflejado';
    return normalized === 'under_stairs' ? 'Bajo escalera' : 'Metálico';
  }
  function rackStyleSub(style){
    const normalized = normalizeRackStyle(style);
    if(normalized === 'melamine') return 'Rack melamina';
    if(normalized === 'under_stairs_reflected') return 'Mueble bajo escalera reflejado';
    return normalized === 'under_stairs' ? 'Mueble bajo escalera' : 'Rack metálico';
  }

  
  function syncLevelEditorCount(modelId){
    const model = rackModel(modelId || appState.selectedModelId);
    if(!model) return;
    const count = Math.max(2, Math.min(12, Number(model.levels || 4) || 4));
    const current = buildLevelHeights(model);
    if(current.length !== count){
      const next = Array.from({length: count}, (_, idx) => current[idx] || current[current.length - 1] || 60);
      model.levelHeights = next;
    }
    const currentSlots = buildLevelSlots(model);
    if(currentSlots.length !== count){
      const nextSlots = Array.from({length: count}, (_, idx) => currentSlots[idx] || currentSlots[currentSlots.length - 1] || Math.max(1, Number(model.slots||2)||2));
      model.levelSlots = nextSlots;
    }
  }

  function renderLevelEditor(){ return; }

  
  function createNewRackModelDraft(){
    recordHistorySnapshot('racks');
    const base = {
      id: 'm_' + Math.random().toString(16).slice(2,8),
      name: 'Nuevo modelo',
      levels: 4,
      width: 120,
      depth: 40,
      height: 240,
      clearance: 0,
      slots: 2,
      beam: 2,
      style: 'metallic',
      levelHeights: [60,60,60,58],
      levelSlots: [2,2,2,2],
      leftHeight: 240,
      rightHeight: 84,
      topLength: 60,
      mirrored: false
    };
    appState.models.push(base);
    appState.selectedModelId = base.id;
    resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = [base.id];
    appState.ui.rackLibraryLevelsOpenIds = [];
    saveRackModels();
    renderRackModels();
  }

  
  function duplicateRackModel(id){
    recordHistorySnapshot('racks');
    const model = rackModel(id);
    if(!model) return;
    const copy = {
      ...clone(model),
      id: 'm_' + Math.random().toString(16).slice(2,8),
      name: `${model.name} copia`
    };
    appState.models.unshift(copy);
    appState.selectedModelId = copy.id;
    resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = [copy.id];
    saveRackModels();
    renderRackModels();
  }

  
  function deleteRackModel(id){
    recordHistorySnapshot('racks');
    if(!id || !Array.isArray(appState.models) || appState.models.length <= 1) return;
    appState.models = appState.models.filter(m => m.id !== id);
    if(!appState.models.some(m => m.id === appState.selectedModelId)) appState.selectedModelId = appState.models[0]?.id || '';
    resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = appState.selectedModelId ? [appState.selectedModelId] : [];
    appState.ui.rackLibraryLevelsOpenIds = appState.ui.rackLibraryLevelsOpenIds.filter(mid => mid !== id);
    saveRackModels();
    renderRackModels();
  }

  
  function useRackModel(id){
    const changed = appState.selectedModelId !== id;
    appState.selectedModelId = id;
    if(changed) resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = [id];
    renderRackModels();
  }

  
  function autoDistributeLevels(modelId){
    recordHistorySnapshot('racks');
    const targetId = modelId || appState.selectedModelId;
    const draft = rackModel(targetId);
    if(!draft) return;
    const count = Math.max(2, Number(draft.levels||4)||4);
    const usable = Math.max(20, draft.height - draft.clearance);
    const each = Math.max(10, Math.round((usable / count) * 10) / 10);
    draft.levelHeights = Array.from({length: count}, () => each);
    draft.levelSlots = Array.from({length: count}, () => Math.max(1, Math.min(6, Number(draft.slots || 2) || 2)));
    appState.selectedModelId = targetId;
    renderRackModels();
  }

  
  function rackModelDraft(){
    const active = rackModel(appState.selectedModelId) || appState.models?.[0] || {
      id:'std_4', name:'Rack estándar 4 niveles', levels:4, width:120, depth:40, height:240, clearance:0, style:'metallic', slots:2, beam:2, levelSlots:[2,2,2,2]
    };
    return clone(active);
  }

  
  async function saveRackModel(){
    recordHistorySnapshot('racks');
    saveRackModels();
    await saveRemoteAppState('modelo de rack');
    renderRackModels();
  }


  function updateRackModelField(id, field, rawValue){
    recordHistorySnapshot('racks');
    const model = rackModel(id);
    if(!model) return;
    appState.selectedModelId = id;
    if(field === 'name') model.name = String(rawValue || '').trimStart() || 'Sin nombre';
    else if(field === 'style') {
      model.style = normalizeRackStyle(rawValue || model.style || 'metallic');
      if(model.style === 'under_stairs_reflected') model.mirrored = true;
      else if(model.style === 'under_stairs') model.mirrored = false;
    }
    else if(field === 'levels'){
      model.levels = Math.max(2, Math.min(12, Number(rawValue || 4) || 4));
      syncLevelEditorCount(id);
    } else if(field === 'width') model.width = Math.max(30, Number(rawValue || model.width || 150) || 150);
    else if(field === 'depth') model.depth = Math.max(20, Number(rawValue || model.depth || 82) || 82);
    else if(field === 'height') model.height = Math.max(60, Number(rawValue || model.height || 238) || 238);
    else if(field === 'leftHeight') model.leftHeight = Math.max(40, Number(rawValue || model.leftHeight || model.height || 238) || 238);
    else if(field === 'rightHeight') model.rightHeight = Math.max(20, Number(rawValue || model.rightHeight || Math.max(40,(model.height||238)*0.35)) || Math.max(40,(model.height||238)*0.35));
    else if(field === 'topLength') model.topLength = Math.max(8, Number(rawValue || model.topLength || Math.max(8, ((model.width||150) * 0.33))) || Math.max(8, ((model.width||150) * 0.33)));
    else if(field === 'mirrored') model.mirrored = !!rawValue;
    else if(field === 'clearance') model.clearance = Math.max(0, Math.min(120, Number(rawValue || model.clearance || 0) || 0));
    else if(field === 'slots'){
      model.slots = Math.max(1, Math.min(6, Number(rawValue || model.slots || 2) || 2));
      model.levelSlots = Array.from({length: Math.max(2, Math.min(12, Number(model.levels || 4) || 4))}, () => model.slots);
    }
    else if(field === 'beam') model.beam = Math.max(2, Math.min(20, Number(rawValue || model.beam || 6) || 6));
    if(field === 'height' || field === 'clearance' || field === 'levels') syncLevelEditorCount(id);
    if(isUnderStairsStyle(model.style)){
      model.leftHeight = Math.max(40, Number(model.leftHeight || model.height || 238) || 238);
      model.rightHeight = Math.max(20, Number(model.rightHeight || Math.max(40, (model.height||238) * 0.35)) || Math.max(40, (model.height||238) * 0.35));
      model.height = Math.max(Number(model.height || 0), Number(model.leftHeight || 0), Number(model.rightHeight || 0));
      model.topLength = clampUnderStairsTopLength(model);
      model.mirrored = normalizeRackStyle(model.style) === 'under_stairs_reflected' ? true : !!model.mirrored;
    }
    renderRackModelPreview();
  }

  
  function buildRackModelSummary(model){ return ''; }

  function renderRackPickerPreview(target, modelId, rackRef = null){
    const svg = typeof target === 'string' ? $(target) : target;
    if(!svg) return;
    const model = rackModel(modelId) || appState.models?.[0];
    if(!model){ svg.innerHTML = ''; return; }
    const rack = rackRef || (appState.selectedRackLayoutId ? findRackById(appState.selectedRackLayoutId) : null) || appState.layout?.racks?.[0] || null;
    const previewRack = rack ? { ...rack, id: rack.id || model.name || 'modelo', modelId: model.id, rackHeight: Math.max(60, Number(rack.rackHeight || model.height || 238) || 238) } : { id: model.name || 'modelo', modelId: model.id, x:0, y:0, w:model.width || 120, h:model.depth || 82, rot:0, baseHeight:0, rackHeight:model.height || 238 };
    renderRackDetail(previewRack.id || model.name || 'modelo', null, svg, model, previewRack);
    try{
      const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
      if(vb && vb.width && vb.height){
        const fit = computePreviewFitView(svg, { x: vb.x, y: vb.y, width: vb.width, height: vb.height }, 20, modelId);
        let finalFit = fit;
        if(svg.id === 'sideRackModelViewerSvg'){
          const cx = fit.x + fit.w / 2;
          const cy = fit.y + fit.h / 2;
          const zoom = 0.7;
          const nw = fit.w * zoom;
          const nh = fit.h * zoom;
          finalFit = { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
        }
        svg.setAttribute('viewBox', `${finalFit.x} ${finalFit.y} ${finalFit.w} ${finalFit.h}`);
      }
    } catch(err) {}
    svg.style.pointerEvents = 'none';
  }

  function initSideRackModelPicker(rack){
    const picker = $('#sideRackModelPicker');
    if(!picker || !rack) return;
    const hidden = $('#sideRackModel');
    const trigger = $('#sideRackModelTrigger');
    const hoverSvg = $('#sideRackModelHoverSvg');
    const viewerSvg = $('#sideRackModelViewerSvg');
    const opts = Array.from($$('[data-rack-model-option]'));
    const selectedId = () => hidden?.value || rack.modelId;
    const updateTrigger = (id) => {
      const model = rackModel(id) || appState.models?.[0];
      const label = trigger ? trigger.querySelector('span') : null;
      if(label) label.textContent = model?.name || id || 'Seleccionar modelo';
      opts.forEach(btn => btn.classList.toggle('active', (btn.getAttribute('data-rack-model-option') || '') === (id || '')));
    };
    const renderFor = (id) => {
      const modelId = id || selectedId();
      if(hoverSvg) renderRackPickerPreview(hoverSvg, modelId, rack);
      if(viewerSvg) renderRackPickerPreview(viewerSvg, modelId, rack);
    };
    updateTrigger(selectedId());
    renderFor(selectedId());
    if(trigger){
      trigger.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        picker.classList.toggle('open');
        renderFor(selectedId());
      };
    }
    opts.forEach(btn => {
      btn.onmouseenter = () => renderFor(btn.getAttribute('data-rack-model-option'));
      btn.onfocus = () => renderFor(btn.getAttribute('data-rack-model-option'));
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-rack-model-option');
        if(hidden){
          hidden.value = id;
          updateTrigger(id);
          renderFor(id);
          hidden.dispatchEvent(new Event('change', { bubbles:true }));
        }
        picker.classList.remove('open');
      };
    });
    picker.onmouseleave = () => renderFor(selectedId());
    if(!window.__rackPickerDocBound){
      document.addEventListener('click', (evt) => {
        document.querySelectorAll('.rack-model-picker.open').forEach(node => {
          if(!node.contains(evt.target)) node.classList.remove('open');
        });
      });
      window.__rackPickerDocBound = true;
    }
  }

  function renderRackModelPreview(){
    const svg = $('#rackModelSvg'); 
    if(!svg) return;
    svg.innerHTML = '';

    const rid = appState.selectedRackLayoutId || appState.selectedProduct?.rack;
    const rack = rid ? findRackById(rid) : (appState.layout?.racks?.[0] || null);
    const activeModelId = appState.selectedModelId || rack?.modelId;
    const hasDraft = false;
    const previewModel = hasDraft ? rackModelDraft() : (rackModel(activeModelId) || appState.models?.[0]);
    const previewRack = rack ? { ...rack, modelId: previewModel?.id || rack.modelId } : { id: previewModel?.name || 'modelo', modelId: previewModel?.id || activeModelId };

    renderRackDetail(rid || previewModel?.name || 'modelo', appState.selectedProduct && rid === appState.selectedProduct.rack ? appState.selectedProduct : null, svg, previewModel, previewRack);
    detailStatus.textContent = rack ? `${rack.id} • ${previewModel?.name || ''}` : (previewModel?.name || '');
    detailChip.textContent = `${previewModel?.levels || 0} niveles • Piso ${previewModel?.clearance || 0}cm`;
    enableRackPreviewNavigation(svg, previewModel?.id || activeModelId);
  }

  function computePreviewFitView(svg, vb, padding = 20, modelId = null){
    const aspect = Math.max(0.3, (svg.clientWidth || 780) / Math.max(1, (svg.clientHeight || 640)));
    const pad = Math.max(0, Number(padding) || 0);
    const innerW = Math.max(1, vb.width);
    const innerH = Math.max(1, vb.height);
    const targetW = innerW + pad * 2;
    const targetH = innerH + pad * 2;
    const cx = vb.x + innerW / 2;
    const cy = vb.y + innerH / 2;
    let w = targetW;
    let h = targetH;
    const currentAspect = targetW / Math.max(1, targetH);
    if(currentAspect > aspect){
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    let view = { x: cx - w / 2, y: cy - h / 2, w, h };
    const model = modelId ? rackModel(modelId) : null;
    const styleKind = normalizeRackStyle(model?.style || '');
    if(styleKind === 'metallic' || styleKind === 'melamine'){
      const zoomFactor = 0.9;
      view = {
        x: view.x + (view.w * (1 - zoomFactor) / 2),
        y: view.y + (view.h * (1 - zoomFactor) / 2) + 120,
        w: Math.max(120, view.w * zoomFactor),
        h: Math.max(140, view.h * zoomFactor)
      };
    } else if(styleKind === 'under_stairs'){
      const zoomFactor = 0.847; // alejar 10% adicional desde 0.77
      view = {
        x: view.x + (view.w * (1 - zoomFactor) / 2),
        y: view.y + (view.h * (1 - zoomFactor) / 2) + 95,
        w: Math.max(120, view.w * zoomFactor),
        h: Math.max(140, view.h * zoomFactor)
      };
    } else if(styleKind === 'under_stairs_reflected'){
      const zoomFactor = 0.7;
      view = {
        x: view.x + (view.w * (1 - zoomFactor) / 2),
        y: view.y + (view.h * (1 - zoomFactor) / 2) + 115,
        w: Math.max(120, view.w * zoomFactor),
        h: Math.max(140, view.h * zoomFactor)
      };
    }
    return view;
  }

  function getCenteredPreviewView(svg, vb, modelId = null){
    return computePreviewFitView(svg, vb, 20, modelId);
  }

  function enableRackPreviewNavigation(svg, modelId){
    if(!svg) return;
    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
    if(!vb || !vb.width || !vb.height) return;
    if(!appState.ui) appState.ui = {};
    const saved = appState.ui.rackPreviewCamera;
    const initialView = getCenteredPreviewView(svg, { x: vb.x, y: vb.y, width: vb.width, height: vb.height }, modelId);
    let view = (saved && saved.modelId === modelId && saved.view) ? { ...saved.view } : { ...initialView };
    let dragging = false;
    let start = null;
    const apply = () => { svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); appState.ui.rackPreviewCamera = { modelId, view: { ...view } }; };
    apply();
    svg.onwheel = (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
      const py = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
      const mx = view.x + view.w * px;
      const my = view.y + view.h * py;
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      const nw = Math.max(120, Math.min(1600, view.w * factor));
      const nh = Math.max(140, Math.min(1800, view.h * factor));
      view.x = mx - nw * px;
      view.y = my - nh * py;
      view.w = nw;
      view.h = nh;
      apply();
    };
    svg.onpointerdown = (e) => {
      dragging = true;
      start = { x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y, w: view.w, h: view.h };
      const stage = document.getElementById('rackPreviewStage');
      if(stage) stage.classList.add('dragging');
      svg.setPointerCapture?.(e.pointerId);
    };
    svg.onpointermove = (e) => {
      if(!dragging || !start) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - start.x) / Math.max(1, rect.width)) * start.w;
      const dy = ((e.clientY - start.y) / Math.max(1, rect.height)) * start.h;
      view.x = start.viewX - dx;
      view.y = start.viewY - dy;
      apply();
    };
    svg.onpointerup = () => { dragging = false; start = null; const stage = document.getElementById('rackPreviewStage'); if(stage) stage.classList.remove('dragging'); };
    svg.onpointercancel = svg.onpointerup;
  }

