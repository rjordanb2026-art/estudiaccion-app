/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - HYBRID LIENZO (CANVAS API + NOTION TEXT BLOCKS)
   ========================================================================== */

class CozyCanvas {
  constructor() {
    this.canvas = document.getElementById('paint-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.workspace = document.getElementById('paper-workspace');
    this.scrollContainer = document.querySelector('.canvas-scroll-container');

    this.isDrawing = false;
    
    // Panning (Hand Tool)
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;
    this.scrollLeftStart = 0;
    this.scrollTopStart = 0;

    // Undo History Stack
    this.undoStack = [];
    this.maxUndoStates = 25;

    this.currentTool = 'pencil'; // 'pencil', 'highlighter', 'eraser', 'text', 'hand'
    this.currentColor = '#4A4E69';
    this.currentStrokeWidth = 4;
    this.notebookId = null;

    // Last pointer coordinates
    this.lastX = 0;
    this.lastY = 0;

    // Default z-index of the paint canvas (pencil tool is active initially)
    this.canvas.style.zIndex = '8';

    this.initCanvasEvents();
    this.initToolbarEvents();
    this.initKeyboardEvents();
    this.initCameraEvents();
  }

  // Bind all canvas drawing, mouse, touch, and double-click actions
  initCanvasEvents() {
    // 1. DRAWING EVENTS (Mouse) - bound to canvas
    this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseup', () => this.handlePointerUp());
    this.canvas.addEventListener('mouseout', () => this.handlePointerUp());

    // 2. DRAWING EVENTS (Touch) - bound to canvas
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.currentTool === 'text') return; // Allow native focus on text clicks!
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.currentTool === 'text') return;
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      if (this.currentTool === 'text') return;
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });

    // 3. PANNING EVENTS (Mouse & Touch) - bound to scroll container
    this.scrollContainer.addEventListener('mousedown', (e) => {
      if (this.currentTool === 'hand') {
        this.isPanning = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.scrollLeftStart = this.scrollContainer.scrollLeft;
        this.scrollTopStart = this.scrollContainer.scrollTop;
      }
    });

    this.scrollContainer.addEventListener('mousemove', (e) => {
      if (this.isPanning && this.currentTool === 'hand') {
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        this.scrollContainer.scrollLeft = this.scrollLeftStart - dx;
        this.scrollContainer.scrollTop = this.scrollTopStart - dy;
      }
    });

    this.scrollContainer.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    this.scrollContainer.addEventListener('mouseleave', () => {
      this.isPanning = false;
    });

    this.scrollContainer.addEventListener('touchstart', (e) => {
      if (this.currentTool === 'hand') {
        const touch = e.touches[0];
        this.isPanning = true;
        this.startX = touch.clientX;
        this.startY = touch.clientY;
        this.scrollLeftStart = this.scrollContainer.scrollLeft;
        this.scrollTopStart = this.scrollContainer.scrollTop;
        e.preventDefault();
      }
    }, { passive: false });

    this.scrollContainer.addEventListener('touchmove', (e) => {
      if (this.isPanning && this.currentTool === 'hand') {
        const touch = e.touches[0];
        const dx = touch.clientX - this.startX;
        const dy = touch.clientY - this.startY;
        this.scrollContainer.scrollLeft = this.scrollLeftStart - dx;
        this.scrollContainer.scrollTop = this.scrollTopStart - dy;
        e.preventDefault();
      }
    }, { passive: false });

    this.scrollContainer.addEventListener('touchend', () => {
      this.isPanning = false;
    });

    // 5. BLOCK SELECTION AND CLICK DETECTION
    this.workspace.addEventListener('mousedown', (e) => {
      const textContainer = e.target.closest('.notion-text-block-container');
      const imageContainer = e.target.closest('.notion-image-block-container');

      if (!textContainer && !imageContainer) {
        // Clear selection if clicking on the background
        const allSelected = this.workspace.querySelectorAll('.selected-block');
        allSelected.forEach(el => el.classList.remove('selected-block'));
        this.selectedBlock = null;
      } else {
        if (textContainer) {
          this.selectBlock('text', textContainer.dataset.id, textContainer);
        } else if (imageContainer) {
          this.selectBlock('image', imageContainer.dataset.id, imageContainer);
        }
      }
    });

    // 4. CANVAS DOUBLE CLICK (Alternative block insertion)
    this.workspace.addEventListener('dblclick', (e) => {
      if (e.target.closest('.notion-text-block-container, .notion-image-block-container')) return;
      const rect = this.workspace.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.createTextBlock(x, y, '');
    });
  }

  // Keyboard Shortcuts (Ctrl+Z and Ctrl+D Duplication)
  initKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // 1. Ctrl+Z Undo
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        this.undo();
      }

      // 2. Ctrl+D Duplicate Selected Block (handles text block even during active typing!)
      if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        const activeEl = document.activeElement;
        const isTypingText = activeEl && activeEl.classList.contains('notion-text-block-content');

        if (this.selectedBlock || isTypingText) {
          e.preventDefault(); // Stop default browser bookmarking behavior!
          
          if (isTypingText) {
            const container = activeEl.closest('.notion-text-block-container');
            if (container) {
              const textContent = activeEl.innerText.trim();
              const id = container.dataset.id;
              // Temporarily save current draft to state so cloning works with latest edits
              stateManager.updateTextBlock(this.notebookId, id, textContent);
              this.selectBlock('text', id, container);
            }
          }

          this.duplicateSelectedBlock();
        }
      }

      // 3. Delete or Backspace to remove selected block (not while editing inside a text field)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeEl = document.activeElement;
        const isTypingText = activeEl && activeEl.classList.contains('notion-text-block-content');
        
        if (this.selectedBlock && !isTypingText) {
          e.preventDefault();
          this.deleteSelectedBlock();
        }
      }
    });

    // Paste images or text directly from clipboard (Ctrl+V from other sites!)
    window.addEventListener('paste', (e) => {
      if (!this.notebookId) return;

      // Check if user is already typing inside an editable field
      const target = e.target;
      const isEditable = target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      const items = (e.clipboardData || window.clipboardData).items;
      let hasImage = false;

      // 1. Handle image paste (priority)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Src = event.target.result;
            const scrollX = this.scrollContainer.scrollLeft + 150;
            const scrollY = this.scrollContainer.scrollTop + 150;
            this.createImageBlock(scrollX, scrollY, base64Src);
          };
          reader.readAsDataURL(file);
          e.preventDefault(); // Stop default paste
          hasImage = true;
          break;
        }
      }

      // 2. Handle global text paste (creates a new text block if not typing inside one)
      if (!hasImage && !isEditable) {
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        if (pastedText && pastedText.trim() !== '') {
          const scrollX = this.scrollContainer.scrollLeft + 150;
          const scrollY = this.scrollContainer.scrollTop + 150;
          this.createTextBlock(scrollX, scrollY, pastedText.trim());
          e.preventDefault();
        }
      }
    });
  }

  // Camera capture stream handler and Cozy webcam modal binding
  initCameraEvents() {
    const btnTakePhoto = document.getElementById('btn-canvas-take-photo');
    const modalCamera = document.getElementById('modal-camera');
    const btnCloseCamera = document.getElementById('btn-close-camera-modal');
    const btnCancelCamera = document.getElementById('btn-cancel-camera-modal');
    const btnCapturePhoto = document.getElementById('btn-capture-photo');
    const videoPreview = document.getElementById('camera-preview');

    if (!btnTakePhoto || !modalCamera) return;

    this.cameraStream = null;

    const stopCamera = () => {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(track => track.stop());
        this.cameraStream = null;
      }
      if (videoPreview) {
        videoPreview.srcObject = null;
      }
    };

    const openCamera = () => {
      if (!this.notebookId) {
        alert('Por favor, abre una libreta para agregarle fotos.');
        return;
      }

      modalCamera.classList.remove('hidden');

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      .then(stream => {
        this.cameraStream = stream;
        if (videoPreview) {
          videoPreview.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Error al acceder a la cámara trasera, probando cualquier cámara:", err);
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            this.cameraStream = stream;
            if (videoPreview) {
              videoPreview.srcObject = stream;
            }
          })
          .catch(err2 => {
            console.error("Error al acceder a la cámara:", err2);
            alert("No se pudo acceder a la cámara. Por favor asegúrate de dar los permisos necesarios en tu navegador.");
            modalCamera.classList.add('hidden');
          });
      });
    };

    const closeCamera = () => {
      stopCamera();
      modalCamera.classList.add('hidden');
    };

    btnTakePhoto.addEventListener('click', openCamera);
    if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCamera);
    if (btnCancelCamera) btnCancelCamera.addEventListener('click', closeCamera);

    if (btnCapturePhoto && videoPreview) {
      btnCapturePhoto.addEventListener('click', () => {
        if (!this.cameraStream) return;

        // Offline capture canvas
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = videoPreview.videoWidth || 640;
        captureCanvas.height = videoPreview.videoHeight || 480;

        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(videoPreview, 0, 0, captureCanvas.width, captureCanvas.height);

        const dataUrl = captureCanvas.toDataURL('image/jpeg');

        // Center relative to scroll
        const scrollX = this.scrollContainer.scrollLeft + 150;
        const scrollY = this.scrollContainer.scrollTop + 150;

        this.createImageBlock(scrollX, scrollY, dataUrl);

        closeCamera();
      });
    }
  }

  // Setup toolbar sliders, buttons, selectors
  initToolbarEvents() {
    // Tool buttons (pencil, highlighter, eraser, text, hand)
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.tool-btn');
        toolBtns.forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');
        this.currentTool = targetBtn.dataset.tool;

        // Apply visual cursor classes to paint canvas and scroll container
        this.canvas.className = '';
        this.scrollContainer.classList.remove('tool-hand');
        if (this.currentTool === 'hand') {
          this.canvas.classList.add('tool-hand');
          this.scrollContainer.classList.add('tool-hand');
        }

        // Dynamic Z-Index Layering based on active tool (drawing sits at 8, hands/texts at 4)
        if (this.currentTool === 'pencil' || this.currentTool === 'highlighter' || this.currentTool === 'eraser') {
          this.canvas.style.zIndex = '8'; // above images (6)
        } else {
          this.canvas.style.zIndex = '4'; // behind images (6)
        }
      });
    });

    // Color picker dots
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        colorDots.forEach(d => d.classList.remove('active'));
        e.target.classList.add('active');
        this.currentColor = e.target.dataset.color;
      });
    });

    // Stroke width slider
    const strokeSlider = document.getElementById('canvas-stroke-width');
    strokeSlider.addEventListener('input', (e) => {
      this.currentStrokeWidth = parseInt(e.target.value);
    });

    // Paper background style select
    const paperSelect = document.getElementById('canvas-paper-style');
    paperSelect.addEventListener('change', (e) => {
      this.setPaperStyle(e.target.value);
      if (this.notebookId) {
        stateManager.updateNotebook(this.notebookId, { paperStyle: e.target.value });
      }
    });

    // Undo action button
    document.getElementById('btn-canvas-undo').addEventListener('click', () => this.undo());

    // Canvas Clear
    document.getElementById('btn-canvas-clear').addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas borrar los trazos de este lienzo?')) {
        this.saveUndoState();
        this.clearCanvas();
        this.saveCurrentDrawing();
      }
    });

    // Canvas Download (PDF/PNG export merger)
    document.getElementById('btn-canvas-download').addEventListener('click', () => this.downloadAsImage());

    // Image Upload button trigger
    const uploadBtn = document.getElementById('btn-canvas-upload-image');
    const fileInput = document.getElementById('canvas-image-input');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        if (!this.notebookId) {
          alert('Por favor, abre una libreta para agregarle imágenes.');
          return;
        }
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Src = event.target.result;
            // Center the image relative to current viewport scroll
            const scrollX = this.scrollContainer.scrollLeft + 150;
            const scrollY = this.scrollContainer.scrollTop + 150;
            this.createImageBlock(scrollX, scrollY, base64Src);
          };
          reader.readAsDataURL(file);
        }
        fileInput.value = ''; // Reset
      });
    }
  }

  // Load a notebook's canvas drawing and Notion-style text blocks
  loadNotebook(id) {
    this.notebookId = id;
    this.undoStack = []; // Reset undo stack per notebook

    const notebook = stateManager.getNotebook(id);
    if (!notebook) return;

    // Reset paper backgrounds
    this.setPaperStyle(notebook.paperStyle);
    document.getElementById('canvas-paper-style').value = notebook.paperStyle;

    // Clear current canvas and DOM blocks
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const existingBlocks = this.workspace.querySelectorAll('.notion-text-block-container, .notion-image-block-container, .notion-text-block');
    existingBlocks.forEach(b => b.remove());

    // Load canvas drawing from base64
    if (notebook.drawData) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0);
      };
      img.src = notebook.drawData;
    }

    // Load Notion blocks
    if (notebook.textBlocks) {
      notebook.textBlocks.forEach(block => {
        this.renderTextBlockDOM(block.id, block.x, block.y, block.text);
      });
    }

    // Load Image blocks
    if (notebook.imageBlocks) {
      notebook.imageBlocks.forEach(img => {
        this.renderImageBlockDOM(img.id, img.x, img.y, img.width, img.height, img.src);
      });
    }
  }

  // Set visual paper texture backgrounds
  setPaperStyle(style) {
    this.workspace.className = 'paper-canvas-wrapper';
    if (style === 'grid') {
      this.workspace.classList.add('paper-grid');
    } else if (style === 'lines') {
      this.workspace.classList.add('paper-lines');
    }
  }

  // Helper to translate click/touch coordinates correctly
  getCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  /* --- MOUSE & TOUCH DOWN HANDLERS --- */
  handlePointerDown(e) {
    // 1. HAND TOOL: Block sketching actions
    if (this.currentTool === 'hand') {
      return;
    }

    // 2. TEXT TOOL: Click to instantly insert a block
    if (this.currentTool === 'text') {
      const rect = this.workspace.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.createTextBlock(x, y, '');
      return;
    }

    // 3. SKETCH TOOLS: Pencil / Highlighter / Eraser
    this.saveUndoState(); // Store historical screenshot before starting drawing
    this.isDrawing = true;
    const coords = this.getCoordinates(e);
    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  handlePointerMove(e) {
    // Hand tool panning - handled globally on scrollContainer
    if (this.currentTool === 'hand') {
      return;
    }

    // Canvas drawing
    if (!this.isDrawing) return;
    
    const coords = this.getCoordinates(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);

    if (this.currentTool === 'pencil') {
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.currentStrokeWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (this.currentTool === 'highlighter') {
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.currentStrokeWidth * 2.5;
      this.ctx.lineCap = 'square';
      this.ctx.lineJoin = 'miter';
      this.ctx.globalAlpha = 0.35;
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (this.currentTool === 'eraser') {
      this.ctx.lineWidth = this.currentStrokeWidth * 3.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'destination-out';
    }

    this.ctx.stroke();

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  handlePointerUp() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveCurrentDrawing();
    }
    this.isPanning = false;
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  saveCurrentDrawing() {
    if (this.notebookId) {
      const dataUrl = this.canvas.toDataURL();
      stateManager.saveNotebookCanvas(this.notebookId, dataUrl);
    }
  }

  /* --- UNDO STACK FUNCTIONS --- */
  saveUndoState() {
    if (this.undoStack.length >= this.maxUndoStates) {
      this.undoStack.shift(); // Evitamos consumo excesivo de memoria
    }
    this.undoStack.push(this.canvas.toDataURL());
  }

  undo() {
    if (!this.notebookId || this.undoStack.length === 0) return;
    
    const lastData = this.undoStack.pop();
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
      this.saveCurrentDrawing();
    };
    img.src = lastData;
  }

  /* --- NOTION-STYLE DRAGGABLE TEXT BLOCKS --- */
  createTextBlock(x, y, text) {
    if (!this.notebookId) return;
    const block = stateManager.addTextBlock(this.notebookId, text, x, y);
    if (block) {
      this.renderTextBlockDOM(block.id, x, y, text);
    }
  }

  renderTextBlockDOM(id, x, y, text) {
    const container = document.createElement('div');
    container.className = 'notion-text-block-container';
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    container.dataset.id = id;

    // Separate Drag Handle (⋮⋮ icon)
    const handle = document.createElement('div');
    handle.className = 'notion-text-block-drag-handle';
    handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
    container.appendChild(handle);

    // Separate contentEditable Div
    const contentDiv = document.createElement('div');
    contentDiv.className = 'notion-text-block-content';
    contentDiv.contentEditable = true;
    contentDiv.innerHTML = text.replace(/\n/g, '<br>') || 'Escribe aquí...';
    container.appendChild(contentDiv);

    // Placeholder behavior
    contentDiv.addEventListener('focus', () => {
      if (contentDiv.innerText.trim() === 'Escribe aquí...') {
        contentDiv.innerHTML = '';
      }
    });

    contentDiv.addEventListener('blur', () => {
      let rawText = contentDiv.innerText.trim();

      if (rawText === '' || rawText === 'Escribe aquí...') {
        container.remove();
        stateManager.deleteTextBlock(this.notebookId, id);
      } else {
        stateManager.updateTextBlock(this.notebookId, id, rawText);
      }
    });

    // Delete Button (tiny trash can)
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'notion-text-block-delete-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    container.appendChild(deleteBtn);

    deleteBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (confirm('¿Eliminar este bloque de texto entero?')) {
        container.remove();
        stateManager.deleteTextBlock(this.notebookId, id);
        if (this.selectedBlock && this.selectedBlock.id === id) {
          this.selectedBlock = null;
        }
      }
    });

    // Make text block container draggable using the vertical handle
    this.makeTextBlockDraggable(container, handle, id);

    this.workspace.appendChild(container);
    
    // Automatically focus new blocks
    if (text === '') {
      setTimeout(() => {
        contentDiv.focus();
      }, 50);
    }
  }

  makeTextBlockDraggable(elem, handle, id) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = (e) => {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation(); // Avoid conflicts
      
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        
        // Save new position
        const x = parseInt(elem.style.left);
        const y = parseInt(elem.style.top);
        stateManager.updateTextBlock(this.notebookId, id, undefined, x, y);
      };
      
      document.onmousemove = (e) => {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        elem.style.left = (elem.offsetLeft - pos1) + "px";
        elem.style.top = (elem.offsetTop - pos2) + "px";
      };
    };
  }

  /* --- DRAGGABLE & RESIZABLE IMAGE BLOCKS --- */
  createImageBlock(x, y, src) {
    if (!this.notebookId) return;
    const block = stateManager.addImageBlock(this.notebookId, src, x, y, 280, 200);
    if (block) {
      this.renderImageBlockDOM(block.id, x, y, 280, 200, src);
    }
  }

  renderImageBlockDOM(id, x, y, width, height, src) {
    const container = document.createElement('div');
    container.className = 'notion-image-block-container';
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    container.style.width = width + 'px';
    container.style.height = height + 'px';
    container.dataset.id = id;

    // Drag Handle
    const handle = document.createElement('div');
    handle.className = 'notion-image-block-drag-handle';
    handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
    container.appendChild(handle);

    // Delete Button
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'notion-image-block-delete-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    container.appendChild(deleteBtn);

    // Image element
    const img = document.createElement('img');
    img.src = src;
    img.className = 'notion-image-block-img';
    container.appendChild(img);

    // Resize Handle (bottom-right corner)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'notion-image-block-resize-handle';
    container.appendChild(resizeHandle);

    // Drag Event
    this.makeImageBlockDraggable(container, handle, id);

    // Resize Event
    this.makeImageBlockResizable(container, resizeHandle, id);

    // Delete Event
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar esta imagen de la libreta?')) {
        container.remove();
        stateManager.deleteImageBlock(this.notebookId, id);
      }
    });

    this.workspace.appendChild(container);
  }

  makeImageBlockDraggable(elem, handle, id) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = (e) => {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        
        // Save new position
        const x = parseInt(elem.style.left);
        const y = parseInt(elem.style.top);
        stateManager.updateImageBlock(this.notebookId, id, { x, y });
      };
      
      document.onmousemove = (e) => {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        elem.style.left = (elem.offsetLeft - pos1) + "px";
        elem.style.top = (elem.offsetTop - pos2) + "px";
      };
    };
  }

  makeImageBlockResizable(elem, handle, id) {
    handle.onmousedown = (e) => {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      
      const startWidth = elem.clientWidth;
      const startHeight = elem.clientHeight;
      const startX = e.clientX;
      const startY = e.clientY;
      
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        
        // Save new dimensions
        const width = elem.clientWidth;
        const height = elem.clientHeight;
        stateManager.updateImageBlock(this.notebookId, id, { width, height });
      };
      
      document.onmousemove = (e) => {
        e = e || window.event;
        e.preventDefault();
        const newWidth = Math.max(100, startWidth + (e.clientX - startX));
        const newHeight = Math.max(80, startHeight + (e.clientY - startY));
        elem.style.width = newWidth + 'px';
        elem.style.height = newHeight + 'px';
      };
    };
  }

  /* --- EXPORT IMAGE MERGER --- */
  downloadAsImage() {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);

    // Create an offline high-res canvas to combine paper background + canvas drawings + text blocks!
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // 1. Draw Paper background
    expCtx.fillStyle = '#FCFAF7';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    if (notebook.paperStyle === 'grid') {
      expCtx.strokeStyle = 'rgba(140, 130, 120, 0.12)';
      expCtx.lineWidth = 1;
      const step = 26;
      for (let x = 0; x < exportCanvas.width; x += step) {
        expCtx.beginPath(); expCtx.moveTo(x, 0); expCtx.lineTo(x, exportCanvas.height); expCtx.stroke();
      }
      for (let y = 0; y < exportCanvas.height; y += step) {
        expCtx.beginPath(); expCtx.moveTo(0, y); expCtx.lineTo(exportCanvas.width, y); expCtx.stroke();
      }
    } else if (notebook.paperStyle === 'lines') {
      expCtx.strokeStyle = 'rgba(140, 130, 120, 0.12)';
      expCtx.lineWidth = 1;
      const step = 28;
      for (let y = 0; y < exportCanvas.height; y += step) {
        expCtx.beginPath(); expCtx.moveTo(0, y); expCtx.lineTo(exportCanvas.width, y); expCtx.stroke();
      }
    }

    // 2. Draw canvas sketch
    const sketchImg = new Image();
    sketchImg.onload = () => {
      expCtx.drawImage(sketchImg, 0, 0);

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      // 3. Draw image blocks (asynchronously load all and draw them!)
      const imagePromises = (notebook.imageBlocks || []).map(imgBlock => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            expCtx.drawImage(
              img, 
              imgBlock.x * scaleX, 
              imgBlock.y * scaleY, 
              imgBlock.width * scaleX, 
              imgBlock.height * scaleY
            );
            resolve();
          };
          img.onerror = () => resolve(); // continue if error
          img.src = imgBlock.src;
        });
      });

      Promise.all(imagePromises).then(() => {
        // 4. Write text blocks (Scale coordinates accordingly)
        expCtx.fillStyle = '#4A3E3D';
        expCtx.font = "bold 20px 'Quicksand', sans-serif";

        if (notebook.textBlocks) {
          notebook.textBlocks.forEach(block => {
            // Multiply by scaling factor to draw at exactly the correct coordinates
            const drawX = block.x * scaleX;
            const drawY = block.y * scaleY;
            
            // Multi-line text support
            const lines = block.text.split('\n');
            lines.forEach((line, index) => {
              expCtx.fillText(line, drawX, drawY + (index * 26));
            });
          });
        }

        // 5. Download Trigger
        const link = document.createElement('a');
        link.download = `${notebook.title}_apuntes.png`;
        link.href = exportCanvas.toDataURL();
        link.click();
      });
    };
    sketchImg.src = this.canvas.toDataURL();
  }

  /* --- BLOCK SELECTION & INSTANT DUPLICATION (CTRL+D) --- */
  selectBlock(type, id, element) {
    // Clear old selection styling
    const allSelected = this.workspace.querySelectorAll('.selected-block');
    allSelected.forEach(el => el.classList.remove('selected-block'));

    this.selectedBlock = { type, id, element };
    element.classList.add('selected-block');
  }

  duplicateSelectedBlock() {
    if (!this.selectedBlock || !this.notebookId) return;

    const id = this.selectedBlock.id;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook) return;

    const elem = this.selectedBlock.element;
    const targetX = parseInt(elem.style.left) + 30;
    const targetY = parseInt(elem.style.top) + 30;

    if (this.selectedBlock.type === 'text') {
      const block = notebook.textBlocks.find(b => b.id === id);
      if (block) {
        const newBlock = stateManager.addTextBlock(this.notebookId, block.text, targetX, targetY);
        if (newBlock) {
          this.renderTextBlockDOM(newBlock.id, targetX, targetY, block.text);
          
          // Auto-select the newly created clone for cascading duplication
          const newElem = this.workspace.querySelector(`.notion-text-block-container[data-id="${newBlock.id}"]`);
          if (newElem) {
            this.selectBlock('text', newBlock.id, newElem);
          }
        }
      }
    } else if (this.selectedBlock.type === 'image') {
      const block = notebook.imageBlocks.find(b => b.id === id);
      if (block) {
        const newBlock = stateManager.addImageBlock(this.notebookId, block.src, targetX, targetY, block.width, block.height);
        if (newBlock) {
          this.renderImageBlockDOM(newBlock.id, targetX, targetY, block.width, block.height, block.src);
          
          // Auto-select the newly created clone for cascading duplication
          const newElem = this.workspace.querySelector(`.notion-image-block-container[data-id="${newBlock.id}"]`);
          if (newElem) {
            this.selectBlock('image', newBlock.id, newElem);
          }
        }
      }
    }
  }

  deleteSelectedBlock() {
    if (!this.selectedBlock || !this.notebookId) return;

    const id = this.selectedBlock.id;
    const type = this.selectedBlock.type;
    const elem = this.selectedBlock.element;

    if (confirm(`¿Estás seguro de que deseas eliminar este bloque de ${type === 'text' ? 'texto' : 'imagen'}?`)) {
      elem.remove();
      if (type === 'text') {
        stateManager.deleteTextBlock(this.notebookId, id);
      } else {
        stateManager.deleteImageBlock(this.notebookId, id);
      }
      this.selectedBlock = null;
    }
  }
}

// Instantiate canvas globally
window.addEventListener('DOMContentLoaded', () => {
  window.cozyCanvas = new CozyCanvas();
});
