/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - FLASHCARDS & REPASO INTELIGENTE
   ========================================================================== */

class CozyFlashcards {
  constructor() {
    this.activeDeckNotebookId = null;
    this.currentSessionCards = [];
    this.currentCardIndex = 0;
    this.isCardFlipped = false;

    // DOM Elements
    this.welcomeView = document.getElementById('flashcards-welcome-view');
    this.sessionView = document.getElementById('study-session-view');
    this.deckGrid = document.getElementById('deck-select-grid');
    this.statTotal = document.getElementById('stat-total-cards');
    this.statReviewed = document.getElementById('stat-reviewed-cards');
    this.statEasy = document.getElementById('stat-easy-cards');

    // Interactive Card Elements
    this.interactiveCard = document.getElementById('interactive-flashcard');
    this.cardFrontText = document.getElementById('card-front-text');
    this.cardBackText = document.getElementById('card-back-text');
    this.revealPrompt = document.getElementById('click-to-reveal-prompt');
    this.ratingControls = document.getElementById('study-rating-buttons');
    this.progressIndicator = document.getElementById('study-progress-indicator');
    this.indexDisplay = document.getElementById('study-index-display');

    // Buttons
    this.btnExitStudy = document.getElementById('btn-exit-study');
    this.btnRevealCard = document.getElementById('btn-reveal-card');

    this.initEvents();
  }

  initEvents() {
    // 3D Card click to flip
    this.interactiveCard.addEventListener('click', () => this.flipCard());

    // Reveal Button
    this.btnRevealCard.addEventListener('click', () => this.revealAnswer());

    // Exit study session
    this.btnExitStudy.addEventListener('click', () => this.exitSession());

    // Study Rating buttons (Easy, Medium, Hard)
    const ratingBtns = document.querySelectorAll('.btn-rating');
    ratingBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ratingBtn = e.target.closest('.btn-rating');
        const difficulty = ratingBtn.dataset.difficulty;
        this.submitCardRating(difficulty);
      });
    });
  }

  // Load general stats and list the notebook decks
  loadWelcomeDashboard() {
    this.welcomeView.classList.remove('hidden');
    this.sessionView.classList.add('hidden');

    // Load stats from state
    const stats = stateManager.getAllFlashcardsCount();
    this.statTotal.innerText = stats.total;
    this.statReviewed.innerText = stats.reviewed;
    this.statEasy.innerText = stats.easy;

    // List notebook decks
    this.deckGrid.innerHTML = '';
    const notebooks = stateManager.getNotebooks();

    notebooks.forEach(n => {
      const cardCount = n.flashcards ? n.flashcards.length : 0;
      
      const deckCard = document.createElement('div');
      deckCard.className = 'deck-card';
      deckCard.innerHTML = `
        <div class="deck-details">
          <h4>${n.title}</h4>
          <p>${cardCount} ${cardCount === 1 ? 'tarjeta' : 'tarjetas'} de repaso</p>
        </div>
        <div class="deck-card-icon" style="color: ${n.coverColor}">
          ${n.icon || '📚'}
        </div>
      `;

      deckCard.addEventListener('click', () => {
        if (cardCount > 0) {
          this.startStudySession(n.id);
        } else {
          alert('Este cuaderno no tiene tarjetas de estudio. ¡Añade algunas desde el lienzo de apuntes!');
        }
      });

      this.deckGrid.appendChild(deckCard);
    });
  }

  // Launch the active recall session
  startStudySession(notebookId) {
    const notebook = stateManager.getNotebook(notebookId);
    if (!notebook || !notebook.flashcards || notebook.flashcards.length === 0) return;

    this.activeDeckNotebookId = notebookId;
    // Clone cards array to shuffle and not affect order in state
    this.currentSessionCards = [...notebook.flashcards];
    this.shuffleCards(this.currentSessionCards);
    
    this.currentCardIndex = 0;
    this.isCardFlipped = false;

    // Toggle views
    this.welcomeView.classList.add('hidden');
    this.sessionView.classList.remove('hidden');

    this.loadCurrentCard();
  }

  shuffleCards(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  loadCurrentCard() {
    this.isCardFlipped = false;
    this.interactiveCard.classList.remove('flipped');

    const card = this.currentSessionCards[this.currentCardIndex];
    this.cardFrontText.innerText = card.front;
    this.cardBackText.innerText = card.back;

    // Reset controls
    this.revealPrompt.classList.remove('hidden');
    this.ratingControls.classList.add('hidden');

    // Update progress bars & indices
    const total = this.currentSessionCards.length;
    const progress = ((this.currentCardIndex) / total) * 100;
    this.progressIndicator.style.width = progress + '%';
    this.indexDisplay.innerText = `${this.currentCardIndex + 1} de ${total}`;
  }

  flipCard() {
    this.isCardFlipped = !this.isCardFlipped;
    this.interactiveCard.classList.toggle('flipped', this.isCardFlipped);

    // If flipped by clicking the card directly, sync control buttons
    if (this.isCardFlipped) {
      this.revealAnswer();
    } else {
      this.revealPrompt.classList.remove('hidden');
      this.ratingControls.classList.add('hidden');
    }
  }

  revealAnswer() {
    this.isCardFlipped = true;
    this.interactiveCard.classList.add('flipped');
    this.revealPrompt.classList.add('hidden');
    this.ratingControls.classList.remove('hidden');
  }

  submitCardRating(difficulty) {
    const card = this.currentSessionCards[this.currentCardIndex];
    
    // Save to global state manager
    stateManager.updateFlashcardDifficulty(this.activeDeckNotebookId, card.id, difficulty);

    // Go to next card
    this.currentCardIndex++;
    if (this.currentCardIndex >= this.currentSessionCards.length) {
      // Completed session!
      this.progressIndicator.style.width = '100%';
      setTimeout(() => {
        alert('¡Felicitaciones! 🎉 Has completado esta sesión de repaso activo de forma excelente.');
        this.exitSession();
      }, 500);
    } else {
      this.loadCurrentCard();
    }
  }

  exitSession() {
    this.activeDeckNotebookId = null;
    this.currentSessionCards = [];
    this.currentCardIndex = 0;
    this.loadWelcomeDashboard();
  }
}

// Instantiate globally
window.addEventListener('DOMContentLoaded', () => {
  window.cozyFlashcards = new CozyFlashcards();
});
