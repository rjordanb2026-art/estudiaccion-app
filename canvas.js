/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - HYBRID LIENZO (CANVAS API + NOTION TEXT BLOCKS)
   ========================================================================== */

class CozyCanvas {
  constructor() {
    this.canvas = document.getElementById('paint-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.bgCanvas = document.getElementById('bg-canvas');
    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;
    this.workspace = document.getElementById('paper-workspace');
    this.scrollContainer = document.querySelector('.canvas-scroll-container');

    // Set PDF.js worker source
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

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

    this.currentTool = 'hand'; // 'pencil', 'highlighter', 'eraser', 'text', 'hand'
    this.currentShape = 'rectangle'; // 'rectangle', 'oval', 'arrow', 'brace'
    this.isDrawingShape = false;
    this.currentColor = '#4A4E69';
    this.currentStrokeWidth = 4;
    this.notebookId = null;

    // Last pointer coordinates
    this.lastX = 0;
    this.lastY = 0;

    // Default z-index of the paint canvas (hand tool is active initially)
    this.canvas.style.zIndex = '4';
    this.canvas.classList.add('tool-hand');
    this.scrollContainer.classList.add('tool-hand');

    // Scale wrapper setup & dynamic resize observer for vertical responsive sheet
    this.initScaleWrapper();
    this.adjustScale();
    window.addEventListener('resize', () => this.adjustScale());

    this.initCanvasEvents();
    this.initToolbarEvents();
    this.initKeyboardEvents();
    this.initCameraEvents();
    this.currentPageIndex = 0;
    this.initPaginationEvents();
  }

  initScaleWrapper() {
    if (!this.workspace || !this.scrollContainer) return;
    let scaler = this.scrollContainer.querySelector('.paper-scaler-wrapper');
    if (!scaler) {
      scaler = document.createElement('div');
      scaler.className = 'paper-scaler-wrapper';
      this.workspace.parentNode.insertBefore(scaler, this.workspace);
      scaler.appendChild(this.workspace);
    }
  }

  adjustScale() {
    if (!this.scrollContainer || !this.workspace) return;
    
    const baseWidth = 1200;
    const baseHeight = 1600;
    let scaler = this.scrollContainer.querySelector('.paper-scaler-wrapper');
    
    // Check if we are on mobile (viewport width <= 768px)
    const isMobile = window.innerWidth <= 768 || document.body.classList.contains('fullscreen-canvas-mode');
    
    if (isMobile) {
      // On mobile, scale to fit BOTH width and height available in container to prevent scrollbar
      const paddingX = 12; // smaller padding for mobile
      const paddingY = 12;
      const availableWidth = this.scrollContainer.clientWidth - paddingX;
      const availableHeight = this.scrollContainer.clientHeight - paddingY;
      
      const scaleX = availableWidth / baseWidth;
      const scaleY = availableHeight / baseHeight;
      const scale = Math.min(scaleX, scaleY);
      
      this.workspace.style.transform = `scale(${scale})`;
      this.workspace.style.transformOrigin = 'top center';
      
      const scaledHeight = baseHeight * scale;
      if (scaler) {
        scaler.style.height = `${scaledHeight}px`;
      }
    } else {
      // Get actual width inside scroll container (minus 32px padding)
      const padding = 32;
      const availableWidth = this.scrollContainer.clientWidth - padding;
      
      if (availableWidth < baseWidth) {
        const scale = availableWidth / baseWidth;
        this.workspace.style.transform = `scale(${scale})`;
        this.workspace.style.transformOrigin = 'top center';
        
        const scaledHeight = baseHeight * scale;
        if (scaler) {
          scaler.style.height = `${scaledHeight}px`;
        }
      } else {
        this.workspace.style.transform = 'none';
        this.workspace.style.transformOrigin = '';
        if (scaler) {
          scaler.style.height = '1600px';
        }
      }
    }
  }

  getCenterCoordinates() {
    if (!this.workspace || !this.scrollContainer) return { x: 600, y: 800 };
    const rect = this.workspace.getBoundingClientRect();
    const scaleX = 1200 / rect.width;
    const scaleY = 1600 / rect.height;
    
    // Find visual center of the scroll container relative to container top-left
    const visualCenterX = this.scrollContainer.scrollLeft + (this.scrollContainer.clientWidth / 2);
    const visualCenterY = this.scrollContainer.scrollTop + (this.scrollContainer.clientHeight / 2);
    
    // Convert visual scroll coordinate to internal 1200x1600 workspace base coordinates
    const baseX = visualCenterX * scaleX;
    const baseY = visualCenterY * scaleY;
    
    return { x: baseX, y: baseY };
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
      const x = (e.clientX - rect.left) * (1200 / rect.width);
      const y = (e.clientY - rect.top) * (1600 / rect.height);
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
            const center = this.getCenterCoordinates();
            this.createImageBlock(center.x - 140, center.y - 100, base64Src);
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
          const center = this.getCenterCoordinates();
          this.createTextBlock(center.x - 100, center.y - 40, pastedText.trim());
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

        // Center relative to scroll using scaled coordinate system
        const center = this.getCenterCoordinates();
        this.createImageBlock(center.x - 140, center.y - 100, dataUrl);

        closeCamera();
      });
    }
  }

  // Setup toolbar sliders, buttons, selectors
  initToolbarEvents() {
    // Tool buttons (pencil, highlighter, eraser, text, shape, hand)
    const toolBtns = document.querySelectorAll('.tool-btn');
    const shapeSelector = document.getElementById('shape-selector');

    toolBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.tool-btn');
        if (!targetBtn) return;
        
        toolBtns.forEach(b => b.classList.remove('active'));
        targetBtn.classList.add('active');
        this.currentTool = targetBtn.dataset.tool;

        // Toggle shape selector dropdown visibility
        if (shapeSelector) {
          if (this.currentTool === 'shape') {
            shapeSelector.style.display = 'flex';
            shapeSelector.classList.remove('hidden');
          } else {
            shapeSelector.style.display = 'none';
            shapeSelector.classList.add('hidden');
          }
        }

        // Apply visual cursor classes to paint canvas and scroll container
        this.canvas.className = '';
        this.scrollContainer.classList.remove('tool-hand');
        if (this.currentTool === 'hand') {
          this.canvas.classList.add('tool-hand');
          this.scrollContainer.classList.add('tool-hand');
        }

        // Dynamic Z-Index Layering based on active tool (drawing sits at 8, shapes at 8, hands/texts at 4)
        if (this.currentTool === 'pencil' || this.currentTool === 'highlighter' || this.currentTool === 'eraser' || this.currentTool === 'shape') {
          this.canvas.style.zIndex = '8'; // above images (6)
        } else {
          this.canvas.style.zIndex = '4'; // behind images (6)
        }
      });
    });

    // Shape Option selection buttons
    const shapeOpts = document.querySelectorAll('.shape-opt');
    shapeOpts.forEach(opt => {
      opt.addEventListener('click', (e) => {
        const targetOpt = e.target.closest('.shape-opt');
        if (!targetOpt) return;
        
        shapeOpts.forEach(o => o.classList.remove('active'));
        targetOpt.classList.add('active');
        this.currentShape = targetOpt.dataset.shape;
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
            // Center relative to scroll using scaled coordinate system
            const center = this.getCenterCoordinates();
            this.createImageBlock(center.x - 140, center.y - 100, base64Src);
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

    // Always reset the active tool to Hand tool on entering any notebook to avoid accidental touch drawing
    this.currentTool = 'hand';
    this.canvas.className = 'tool-hand';
    this.scrollContainer.className = 'canvas-scroll-container tool-hand';
    this.canvas.style.zIndex = '4';

    // Update the active state button on the toolbar UI
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
      if (btn.dataset.tool === 'hand') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.adjustScale();

    const notebook = stateManager.getNotebook(id);
    if (!notebook) return;

    // --- PAGINATED RETROCOMPATIBILITY MIGRATION ---
    if (!notebook.pages || notebook.pages.length === 0) {
      notebook.pages = [{
        drawData: notebook.drawData || null,
        textBlocks: notebook.textBlocks || [],
        imageBlocks: notebook.imageBlocks || [],
        paperStyle: notebook.paperStyle || 'grid'
      }];
      stateManager.updateNotebook(id, { pages: notebook.pages });
    }

    this.currentPageIndex = 0;
    this.loadPageIndex(0);
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
      const x = (e.clientX - rect.left) * (1200 / rect.width);
      const y = (e.clientY - rect.top) * (1600 / rect.height);
      this.createTextBlock(x, y, '');
      return;
    }

    // 3. SHAPE TOOL: Click to start drawing a shape
    if (this.currentTool === 'shape') {
      this.saveUndoState();
      const coords = this.getCoordinates(e);
      this.startX = coords.x;
      this.startY = coords.y;
      this.isDrawingShape = true;
      // Capture current screen content for drag preview
      this.dragShapeImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    // 4. SKETCH TOOLS: Pencil / Highlighter / Eraser
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

    // Shape tool dragging
    if (this.isDrawingShape && this.currentTool === 'shape') {
      const coords = this.getCoordinates(e);
      // Restore saved screenshot to clear previous frame preview
      this.ctx.putImageData(this.dragShapeImageData, 0, 0);
      
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.currentColor;
      this.ctx.lineWidth = this.currentStrokeWidth;
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      const width = coords.x - this.startX;
      const height = coords.y - this.startY;

      if (this.currentShape === 'rectangle') {
        this.ctx.rect(this.startX, this.startY, width, height);
        this.ctx.stroke();
      } else if (this.currentShape === 'oval') {
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        const radiusX = Math.abs(width / 2);
        const radiusY = Math.abs(height / 2);
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        this.ctx.stroke();
      } else if (this.currentShape === 'arrow') {
        // Draw line
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(coords.y - this.startY, coords.x - this.startX);
        const headLength = 15 + this.currentStrokeWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
        this.ctx.lineTo(coords.x - headLength * Math.cos(angle - Math.PI / 6), coords.y - headLength * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(coords.x, coords.y);
        this.ctx.lineTo(coords.x - headLength * Math.cos(angle + Math.PI / 6), coords.y - headLength * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
      } else if (this.currentShape === 'brace') {
        this.drawBrace(this.startX, this.startY, coords.x, coords.y);
      }
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
    if (this.isDrawingShape) {
      this.isDrawingShape = false;
      this.saveCurrentDrawing();
    }
    this.isPanning = false;
  }

  drawBrace(x1, y1, x2, y2) {
    this.ctx.beginPath();
    
    // Determine if it is a mostly vertical drag or mostly horizontal drag
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    
    if (dy > dx) {
      // VERTICAL BRACE
      const startY = Math.min(y1, y2);
      const endY = Math.max(y1, y2);
      const dY = endY - startY;
      
      if (dY < 10) return; // avoid drawing tiny division-by-zero braces
      
      const midY = startY + dY / 2;
      const qY1 = startY + dY / 4;
      const qY2 = endY - dY / 4;
      const w = x2 - x1; // width and cusp direction
      
      // Arc 1: start at (x1, startY) and curves towards (x1 + w/2, qY1)
      this.ctx.moveTo(x1, startY);
      this.ctx.bezierCurveTo(x1, startY + dY/8, x1 + w/2, startY + dY/8, x1 + w/2, qY1);
      
      // Arc 2: continues to cusp at (x2, midY)
      this.ctx.bezierCurveTo(x1 + w/2, midY - dY/8, x2, midY - dY/8, x2, midY);
      
      // Arc 3: goes from cusp (x2, midY) back to (x1 + w/2, qY2)
      this.ctx.bezierCurveTo(x2, midY + dY/8, x1 + w/2, midY + dY/8, x1 + w/2, qY2);
      
      // Arc 4: curves back to end at (x1, endY)
      this.ctx.bezierCurveTo(x1 + w/2, endY - dY/8, x1, endY - dY/8, x1, endY);
    } else {
      // HORIZONTAL BRACE
      const startX = Math.min(x1, x2);
      const endX = Math.max(x1, x2);
      const dX = endX - startX;
      
      if (dX < 10) return;
      
      const midX = startX + dX / 2;
      const qX1 = startX + dX / 4;
      const qX2 = endX - dX / 4;
      const h = y2 - y1; // height and cusp direction
      
      // Arc 1: start at (startX, y1) and curves towards (qX1, y1 + h/2)
      this.ctx.moveTo(startX, y1);
      this.ctx.bezierCurveTo(startX + dX/8, y1, startX + dX/8, y1 + h/2, qX1, y1 + h/2);
      
      // Arc 2: continues to cusp at (midX, y2)
      this.ctx.bezierCurveTo(midX - dX/8, y1 + h/2, midX - dX/8, y2, midX, y2);
      
      // Arc 3: goes from cusp (midX, y2) back to (qX2, y1 + h/2)
      this.ctx.bezierCurveTo(midX + dX/8, y2, midX + dX/8, y1 + h/2, qX2, y1 + h/2);
      
      // Arc 4: curves back to end at (endX, y1)
      this.ctx.bezierCurveTo(endX - dX/8, y1 + h/2, endX, y1, endX, y1);
    }
    
    this.ctx.stroke();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  saveCurrentDrawing() {
    if (this.notebookId) {
      this.saveCurrentPageState();
    }
  }

  /* --- UNDO STACK FUNCTIONS --- */
  saveUndoState() {
    if (this.undoStack.length >= this.maxUndoStates) {
      this.undoStack.shift(); // Evitamos consumo excesivo de memoria
    }
    const currentState = this.canvas.toDataURL();
    if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== currentState) {
      this.undoStack.push(currentState);
    }
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
    const block = stateManager.addTextBlock(this.notebookId, text, x, y, false);
    if (block) {
      this.renderTextBlockDOM(block.id, x, y, text, false);
    }
  }

  renderTextBlockDOM(id, x, y, text, transparent = false) {
    const container = document.createElement('div');
    container.className = 'notion-text-block-container';
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    container.dataset.id = id;

    if (transparent) {
      container.classList.add('transparent-bg');
    }

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
        const isTransparent = container.classList.contains('transparent-bg');
        stateManager.updateTextBlock(this.notebookId, id, rawText, undefined, undefined, isTransparent);
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

    // Background Toggle Button (¡Nuevo! 🎨)
    const bgToggleBtn = document.createElement('div');
    bgToggleBtn.className = 'notion-text-block-bg-toggle-btn';
    bgToggleBtn.innerHTML = transparent ? '<i class="fa-solid fa-fill"></i>' : '<i class="fa-solid fa-fill-drip"></i>';
    bgToggleBtn.title = transparent ? 'Mostrar fondo de bloque' : 'Hacer fondo transparente';
    container.appendChild(bgToggleBtn);

    bgToggleBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const isCurrentlyTransparent = container.classList.contains('transparent-bg');
      if (isCurrentlyTransparent) {
        container.classList.remove('transparent-bg');
        bgToggleBtn.innerHTML = '<i class="fa-solid fa-fill-drip"></i>';
        bgToggleBtn.title = 'Hacer fondo transparente';
        stateManager.updateTextBlock(this.notebookId, id, undefined, undefined, undefined, false);
      } else {
        container.classList.add('transparent-bg');
        bgToggleBtn.innerHTML = '<i class="fa-solid fa-fill"></i>';
        bgToggleBtn.title = 'Mostrar fondo de bloque';
        stateManager.updateTextBlock(this.notebookId, id, undefined, undefined, undefined, true);
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
        
        const rect = this.workspace.getBoundingClientRect();
        const scale = rect.width / 1200;
        
        elem.style.left = (elem.offsetLeft - (pos1 / scale)) + "px";
        elem.style.top = (elem.offsetTop - (pos2 / scale)) + "px";
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
        
        const rect = this.workspace.getBoundingClientRect();
        const scale = rect.width / 1200;
        
        elem.style.left = (elem.offsetLeft - (pos1 / scale)) + "px";
        elem.style.top = (elem.offsetTop - (pos2 / scale)) + "px";
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
        
        const rect = this.workspace.getBoundingClientRect();
        const scale = rect.width / 1200;
        
        const newWidth = Math.max(100, startWidth + ((e.clientX - startX) / scale));
        const newHeight = Math.max(80, startHeight + ((e.clientY - startY) / scale));
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

    // 2. Draw base PDF background directly from the bgCanvas layer if exists
    if (this.bgCanvas) {
      expCtx.drawImage(this.bgCanvas, 0, 0);
    }

    // 3. Draw paint canvas strokes
    expCtx.drawImage(this.canvas, 0, 0);

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    // 4. Draw image blocks (asynchronously load all and draw them!)
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
      // 5. Write text blocks (Scale coordinates accordingly)
      expCtx.fillStyle = '#4A3E3D';
      expCtx.font = "bold 20px 'Quicksand', sans-serif";

      if (notebook.textBlocks) {
        notebook.textBlocks.forEach(block => {
          // Multiply by scaling factor to draw at exactly the correct coordinates
          const drawX = block.x * scaleX;
          const drawY = block.y * scaleY;
          const lines = block.text.split('\n');
          
          // Draw a beautiful cozy white background block if NOT transparent
          if (!block.transparent) {
            expCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            let maxLen = 0;
            lines.forEach(l => { if (l.length > maxLen) maxLen = l.length; });
            const blockWidth = Math.min(320 * scaleX, Math.max(160 * scaleX, (maxLen * 11 + 24) * scaleX));
            const blockHeight = (lines.length * 26 + 18) * scaleY;
            
            expCtx.beginPath();
            if (expCtx.roundRect) {
              expCtx.roundRect(drawX - 8, drawY - 20, blockWidth, blockHeight, 8 * scaleX);
            } else {
              expCtx.rect(drawX - 8, drawY - 20, blockWidth, blockHeight);
            }
            expCtx.fill();
          }
          
          // Draw the actual text lines on top
          expCtx.fillStyle = '#4A3E3D';
          lines.forEach((line, index) => {
            expCtx.fillText(line, drawX, drawY + (index * 26));
          });
        });
      }

      // 6. Download Trigger
      const link = document.createElement('a');
      link.download = `${notebook.title}_apuntes.png`;
      link.href = exportCanvas.toDataURL();
      link.click();
    });
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
        const newBlock = stateManager.addTextBlock(this.notebookId, block.text, targetX, targetY, block.transparent);
        if (newBlock) {
          this.renderTextBlockDOM(newBlock.id, targetX, targetY, block.text, block.transparent);
          
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

  saveCurrentPageState() {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook) return;
    
    // Ensure pages array is initialized
    if (!notebook.pages) {
      notebook.pages = [{
        drawData: notebook.drawData || null,
        textBlocks: notebook.textBlocks || [],
        imageBlocks: notebook.imageBlocks || [],
        paperStyle: notebook.paperStyle || 'grid'
      }];
    }
    
    // Capture canvas drawData
    const drawData = this.canvas.toDataURL();
    
    // Capture text blocks currently in the workspace DOM
    const textBlocks = [];
    this.workspace.querySelectorAll('.notion-text-block-container').forEach(elem => {
      const id = elem.dataset.id;
      const x = parseFloat(elem.style.left);
      const y = parseFloat(elem.style.top);
      const contentEl = elem.querySelector('.notion-text-block-content');
      const text = contentEl ? contentEl.innerText.trim() : '';
      const transparent = elem.classList.contains('transparent-bg');
      if (text !== '' && text !== 'Escribe aquí...') {
        textBlocks.push({ id, text, x, y, transparent });
      }
    });
    
    // Capture image blocks currently in the workspace DOM
    const imageBlocks = [];
    this.workspace.querySelectorAll('.notion-image-block-container').forEach(elem => {
      const id = elem.dataset.id;
      const x = parseFloat(elem.style.left);
      const y = parseFloat(elem.style.top);
      const imgEl = elem.querySelector('.notion-image-block-img');
      const src = imgEl ? imgEl.src : '';
      const width = parseFloat(elem.style.width || elem.clientWidth);
      const height = parseFloat(elem.style.height || elem.clientHeight);
      if (src) {
        imageBlocks.push({ id, src, x, y, width, height });
      }
    });
    
    // Get paper background style
    const paperSelect = document.getElementById('canvas-paper-style');
    const paperStyle = paperSelect ? paperSelect.value : 'grid';
    
    // Save to active page
    if (!notebook.pages[this.currentPageIndex]) {
      notebook.pages[this.currentPageIndex] = {};
    }
    
    // Capture background PDF page if it was loaded on bgCanvas
    const pdfBackground = notebook.pages[this.currentPageIndex] ? notebook.pages[this.currentPageIndex].pdfBackground : null;
    
    notebook.pages[this.currentPageIndex].drawData = drawData;
    notebook.pages[this.currentPageIndex].pdfBackground = pdfBackground;
    notebook.pages[this.currentPageIndex].textBlocks = textBlocks;
    notebook.pages[this.currentPageIndex].imageBlocks = imageBlocks;
    notebook.pages[this.currentPageIndex].paperStyle = paperStyle;
    
    // Persist to stateManager
    stateManager.updateNotebook(this.notebookId, { 
      pages: notebook.pages,
      // For backward-compatibility with non-paginated access:
      drawData: notebook.pages[0].drawData,
      pdfBackground: notebook.pages[0].pdfBackground,
      textBlocks: notebook.pages[0].textBlocks,
      imageBlocks: notebook.pages[0].imageBlocks,
      paperStyle: notebook.pages[0].paperStyle
    });
  }

  loadPageIndex(index) {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook || !notebook.pages || !notebook.pages[index]) return;
    
    this.currentPageIndex = index;
    const page = notebook.pages[index];
    
    // Reset paper style selection
    this.setPaperStyle(page.paperStyle || 'grid');
    const paperSelect = document.getElementById('canvas-paper-style');
    if (paperSelect) paperSelect.value = page.paperStyle || 'grid';
    
    // Clear canvas, background canvas, and existing DOM blocks
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.bgCtx) {
      this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
    }
    const existingBlocks = this.workspace.querySelectorAll('.notion-text-block-container, .notion-image-block-container, .notion-text-block');
    existingBlocks.forEach(b => b.remove());
    
    // Reset undo stack for this page load
    this.undoStack = [];
    
    const hasPdfBackground = page.pdfBackground && page.pdfBackground !== 'data:,';
    const hasDrawData = page.drawData && page.drawData !== 'data:,';
    
    let loadedCount = 0;
    const totalToLoad = (hasPdfBackground ? 1 : 0) + (hasDrawData ? 1 : 0);
    
    const checkAndInitUndoStack = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        // Initialize undo stack with the fully rendered/loaded strokes state
        this.undoStack = [this.canvas.toDataURL()];
      }
    };
    
    // 1. Draw PDF Background layer if exists
    if (hasPdfBackground) {
      const bgImg = new Image();
      bgImg.onload = () => {
        if (this.bgCtx) {
          this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
          this.bgCtx.drawImage(bgImg, 0, 0);
        }
        checkAndInitUndoStack();
      };
      bgImg.src = page.pdfBackground;
    }
    
    // 2. Draw user hand-drawn strokes layer if exists
    if (hasDrawData) {
      const fgImg = new Image();
      fgImg.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(fgImg, 0, 0);
        checkAndInitUndoStack();
      };
      fgImg.src = page.drawData;
    }
    
    // 3. Fallback: if nothing to load, initialize the empty stack immediately
    if (totalToLoad === 0) {
      this.undoStack = [this.canvas.toDataURL()];
    }
    
    // Render Text blocks
    if (page.textBlocks) {
      page.textBlocks.forEach(block => {
        this.renderTextBlockDOM(block.id, block.x, block.y, block.text, block.transparent);
      });
    }
    
    // Render Image blocks
    if (page.imageBlocks) {
      page.imageBlocks.forEach(img => {
        this.renderImageBlockDOM(img.id, img.x, img.y, img.width, img.height, img.src);
      });
    }
    
    // Update pagination UI
    this.updatePaginationUI();
  }

  addNewPage() {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook) return;
    
    // Save current page state first
    this.saveCurrentPageState();
    
    // Create a new blank page object
    const newPage = {
      drawData: null,
      textBlocks: [],
      imageBlocks: [],
      paperStyle: 'grid'
    };
    
    if (!notebook.pages) {
      notebook.pages = [{
        drawData: notebook.drawData || null,
        textBlocks: notebook.textBlocks || [],
        imageBlocks: notebook.imageBlocks || [],
        paperStyle: notebook.paperStyle || 'grid'
      }];
    }
    
    // Insert new page after the current page index
    notebook.pages.splice(this.currentPageIndex + 1, 0, newPage);
    
    // Save updated pages list
    stateManager.updateNotebook(this.notebookId, { pages: notebook.pages });
    
    // Load the new page index
    this.loadPageIndex(this.currentPageIndex + 1);
  }

  deleteCurrentPage() {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook || !notebook.pages) return;
    
    if (notebook.pages.length <= 1) {
      alert("No puedes eliminar la única página de este cuaderno. 💡");
      return;
    }
    
    if (confirm("¿Estás seguro de que deseas eliminar esta página por completo? Esta acción es irreversible.")) {
      // Remove page
      notebook.pages.splice(this.currentPageIndex, 1);
      
      // Save updated pages list
      stateManager.updateNotebook(this.notebookId, { pages: notebook.pages });
      
      // Navigate to previous page or index 0
      const nextIndex = Math.max(0, this.currentPageIndex - 1);
      this.loadPageIndex(nextIndex);
    }
  }

  updatePaginationUI() {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook || !notebook.pages) return;
    
    const totalPages = notebook.pages.length;
    const currentPage = this.currentPageIndex + 1;
    
    const indicator = document.getElementById('page-indicator');
    if (indicator) {
      indicator.innerText = `Pág. ${currentPage} / ${totalPages}`;
    }
    
    const btnPrev = document.getElementById('btn-page-prev');
    const btnNext = document.getElementById('btn-page-next');
    
    if (btnPrev) {
      btnPrev.disabled = this.currentPageIndex === 0;
      btnPrev.style.opacity = this.currentPageIndex === 0 ? '0.5' : '1';
    }
    
    if (btnNext) {
      btnNext.disabled = this.currentPageIndex === totalPages - 1;
      btnNext.style.opacity = this.currentPageIndex === totalPages - 1 ? '0.5' : '1';
    }
  }

  initPaginationEvents() {
    const btnPrev = document.getElementById('btn-page-prev');
    const btnNext = document.getElementById('btn-page-next');
    const btnAdd = document.getElementById('btn-page-add');
    const btnDel = document.getElementById('btn-page-delete');
    
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.currentPageIndex > 0) {
          this.saveCurrentPageState();
          this.loadPageIndex(this.currentPageIndex - 1);
        }
      });
    }
    
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const notebook = stateManager.getNotebook(this.notebookId);
        if (notebook && notebook.pages && this.currentPageIndex < notebook.pages.length - 1) {
          this.saveCurrentPageState();
          this.loadPageIndex(this.currentPageIndex + 1);
        }
      });
    }
    
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.addNewPage();
      });
    }
    
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        this.deleteCurrentPage();
      });
    }
  }

  async importPDFFile(file) {
    if (!file) return;

    // Show loading indicator
    const originalBtn = document.getElementById('btn-trigger-pdf-import');
    const originalText = originalBtn ? originalBtn.innerHTML : '';
    if (originalBtn) {
      originalBtn.disabled = true;
      originalBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando PDF...';
    }

    try {
      const fileReader = new FileReader();
      
      const arrayBuffer = await new Promise((resolve, reject) => {
        fileReader.onload = (e) => resolve(e.target.result);
        fileReader.onerror = (err) => reject(err);
        fileReader.readAsArrayBuffer(file);
      });

      // Load PDF using PDF.js
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      // Let the user select custom ranges/pages (supports comma-separated values like "3, 5-8, 12, 45-49, 104-110")
      let selectedPages = [];
      
      const rangeInput = prompt(
        `El PDF "${file.name}" tiene ${numPages} páginas.\n\n` +
        `Para no superar el límite de la base de datos del navegador (5MB), te recomendamos importar solo las páginas que necesites.\n\n` +
        `Escribe las páginas o rangos a importar separados por comas (ej: "3, 5-8, 12, 45-49, 104-110") o déjalo vacío para importar TODAS las páginas:`
      );
      
      if (rangeInput !== null && rangeInput.trim() !== '') {
        const segments = rangeInput.split(',');
        const pageSet = new Set();
        
        segments.forEach(seg => {
          const sTrim = seg.trim();
          if (sTrim.includes('-')) {
            const parts = sTrim.split('-');
            if (parts.length === 2) {
              const start = parseInt(parts[0].trim());
              const end = parseInt(parts[1].trim());
              if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= numPages && start <= end) {
                for (let p = start; p <= end; p++) {
                  pageSet.add(p);
                }
              }
            }
          } else {
            const pNum = parseInt(sTrim);
            if (!isNaN(pNum) && pNum >= 1 && pNum <= numPages) {
              pageSet.add(pNum);
            }
          }
        });
        
        selectedPages = Array.from(pageSet).sort((a, b) => a - b);
        
        if (selectedPages.length === 0) {
          alert("No se ingresaron páginas válidas. Se importarán todas las páginas.");
          for (let p = 1; p <= numPages; p++) selectedPages.push(p);
        }
      } else {
        for (let p = 1; p <= numPages; p++) selectedPages.push(p);
      }

      const pagesToImport = selectedPages.length;

      // Limit check: 30 pages warning (LocalStorage budget protection)
      if (pagesToImport > 30) {
        if (!confirm(`Vas a importar ${pagesToImport} páginas. Para asegurar un rendimiento perfecto del navegador y que quepa en tu base de datos local (5MB límite), te recomendamos importar menos de 30 páginas. ¿Deseas continuar de todas formas?`)) {
          if (originalBtn) {
            originalBtn.disabled = false;
            originalBtn.innerHTML = originalText;
          }
          return;
        }
      }

      // Create new paginated notebook
      const title = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      const subject = "Importado 📄";
      const coverColor = "#A8DADC"; // pastel cyan
      const icon = "📄";
      
      const newNotebook = stateManager.createNotebook(title, subject, coverColor, icon);
      const notebookId = newNotebook.id;

      const pages = [];

      // Loop page by page
      for (let i = 0; i < selectedPages.length; i++) {
        const pageNum = selectedPages[i];
        const page = await pdf.getPage(pageNum);
        
        // Render page onto a high-res canvas
        const viewport = page.getViewport({ scale: 2.0 }); // 2x for sharp detail
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1200;
        tempCanvas.height = 1600;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw PDF page fitted inside 1200x1600 canvas
        await page.render({
          canvasContext: tempCtx,
          viewport: page.getViewport({ scale: Math.min(1200 / viewport.width, 1600 / viewport.height) * 2.0 })
        }).promise;
        
        // Export page image as compressed JPEG (quality 0.6)
        const drawData = tempCanvas.toDataURL('image/jpeg', 0.60);

        pages.push({
          pdfBackground: drawData, // Separate base background layer
          drawData: null,          // Empty strokes foreground layer
          textBlocks: [],
          imageBlocks: [],
          paperStyle: 'blank' // blank background since PDF is active!
        });
      }

      // Update notebook with pages and set paperStyle to blank
      stateManager.updateNotebook(notebookId, { 
        pages: pages,
        paperStyle: 'blank',
        drawData: pages[0].pdfBackground // Use the PDF background for cover thumbnail preview!
      });

      // Close create notebook modal
      const modal = document.getElementById('modal-create-notebook');
      if (modal) modal.classList.add('hidden');

      // Refresh bookshelf
      if (window.cozyApp) {
        window.cozyApp.renderBookshelf();
        // Automatically open the imported notebook!
        window.cozyApp.openNotebook(notebookId);
      }

      alert(`¡Éxito! Se ha creado la libreta "${title}" con ${numPages} páginas del PDF. Puedes escribir y anotar directamente encima. ✨`);

    } catch (error) {
      console.error("Error al importar PDF:", error);
      alert("Ocurrió un error al procesar el archivo PDF. Asegúrate de que no tenga contraseña o esté corrupto.");
    } finally {
      if (originalBtn) {
        originalBtn.disabled = false;
        originalBtn.innerHTML = originalText;
      }
    }
  }

  async exportActiveNotebookAsPDF() {
    if (!this.notebookId) return;
    const notebook = stateManager.getNotebook(this.notebookId);
    if (!notebook || !notebook.pages || notebook.pages.length === 0) {
      alert("No hay páginas en este cuaderno para exportar.");
      return;
    }

    // Save active page before exporting
    this.saveCurrentPageState();

    // Show export loader
    const exportBtn = document.getElementById('btn-export-pdf');
    const originalHTML = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      // Import jsPDF using window.jspdf.jsPDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [1200, 1600]
      });

      // Loop page by page
      for (let i = 0; i < notebook.pages.length; i++) {
        const page = notebook.pages[i];
        
        // Create canvas for merging background, drawings, text blocks, and image blocks
        const mergeCanvas = document.createElement('canvas');
        mergeCanvas.width = 1200;
        mergeCanvas.height = 1600;
        const mergeCtx = mergeCanvas.getContext('2d');

        // Step 1: Draw paper texture background
        this.drawPaperBackground(mergeCtx, page.paperStyle || 'grid');

        // Step 2: Draw base PDF background page if exists
        if (page.pdfBackground && page.pdfBackground !== 'data:,') {
          const bgImg = await new Promise((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => resolve(tempImg);
            tempImg.src = page.pdfBackground;
          });
          mergeCtx.drawImage(bgImg, 0, 0, 1200, 1600);
        }
        
        // Step 2b: Draw user hand-drawn strokes
        if (page.drawData && page.drawData !== 'data:,') {
          const fgImg = await new Promise((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => resolve(tempImg);
            tempImg.src = page.drawData;
          });
          mergeCtx.drawImage(fgImg, 0, 0, 1200, 1600);
        }

        // Step 3: Draw image blocks
        if (page.imageBlocks) {
          for (let imgBlock of page.imageBlocks) {
            if (imgBlock.src) {
              const img = await new Promise((resolve) => {
                const tempImg = new Image();
                tempImg.onload = () => resolve(tempImg);
                tempImg.src = imgBlock.src;
              });
              mergeCtx.drawImage(img, imgBlock.x, imgBlock.y, imgBlock.width, imgBlock.height);
            }
          }
        }

        // Step 4: Draw text blocks
        if (page.textBlocks) {
          page.textBlocks.forEach(block => {
            this.drawTextBlockOnCanvas(mergeCtx, block);
          });
        }

        // Convert merged canvas to high quality JPEG image (quality 0.85)
        const imgData = mergeCanvas.toDataURL('image/jpeg', 0.85);

        // Add page to PDF
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, 1200, 1600);
      }

      // Save compiled PDF
      const filename = `${notebook.title || 'Libreta'}_editado.pdf`;
      pdf.save(filename);

      alert(`¡Excelente! El PDF "${filename}" ha sido exportado y descargado con éxito con todas tus anotaciones. 📄✨`);
    } catch (err) {
      console.error("Error al exportar PDF:", err);
      alert("Ocurrió un error inesperado al compilar el PDF de exportación.");
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHTML;
      }
    }
  }

  drawPaperBackground(ctx, style) {
    ctx.fillStyle = '#FCFAF7'; // cozy paper color
    ctx.fillRect(0, 0, 1200, 1600);
    
    if (style === 'grid') {
      ctx.fillStyle = 'rgba(140, 130, 120, 0.18)';
      for (let x = 0; x < 1200; x += 26) {
        for (let y = 0; y < 1600; y += 26) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    } else if (style === 'lines') {
      ctx.strokeStyle = 'rgba(140, 130, 120, 0.18)';
      ctx.lineWidth = 1;
      for (let y = 0; y < 1600; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1200, y);
        ctx.stroke();
      }
    }
  }

  drawTextBlockOnCanvas(ctx, block) {
    const padding = 10;
    const blockWidth = 260;
    const lineHeight = 22;
    
    ctx.font = '16px Quicksand, sans-serif';
    ctx.fillStyle = '#4A3E3D';
    ctx.textBaseline = 'top';
    
    // Split block text into lines with wrapping
    const paragraphs = block.text.split('\n');
    const lines = [];
    
    paragraphs.forEach(p => {
      const words = p.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > (blockWidth - padding * 2) && currentLine !== '') {
          lines.push(currentLine.trim());
          currentLine = word + ' ';
        } else {
          currentLine = testLine;
        }
      });
      lines.push(currentLine.trim());
    });
    
    const blockHeight = lines.length * lineHeight + padding * 2;
    
    // Draw background if not transparent
    if (!block.transparent) {
      ctx.fillStyle = '#FAF6EE'; // Cozy light cream background
      ctx.strokeStyle = '#E2DDD5';
      ctx.lineWidth = 1;
      // Draw rounded rectangle
      this.drawRoundedRect(ctx, block.x, block.y, blockWidth, blockHeight, 6);
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw text lines
    ctx.fillStyle = '#4A3E3D';
    let currentY = block.y + padding;
    lines.forEach(line => {
      ctx.fillText(line, block.x + padding, currentY);
      currentY += lineHeight;
    });
  }
  
  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

// Instantiate canvas globally
window.addEventListener('DOMContentLoaded', () => {
  window.cozyCanvas = new CozyCanvas();
});
