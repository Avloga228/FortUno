// Генерація повної колоди згідно з RULES.txt

const COLORS = ["red", "yellow", "green", "blue", "purple"];
const BLACK = "black";
const VALUES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SPECIALS = ["Пропуск ходу", "Обертання ходу"];
const BLACK_SPECIALS = ["+3 карти", "+5 карт", "ФортУно"];

// Створити одну пару карт певного типу і кольору
function createPair(value, color) {
  return [
    { value, color },
    { value, color }
  ];
}

// Створити всі цифрові та спеціальні карти (крім чорних)
function createColoredCards() {
  let cards = [];
  for (const color of COLORS) {
    for (const value of VALUES) {
      cards.push(...createPair(value, color));
    }
    for (const special of SPECIALS) {
      cards.push(...createPair(special, color));
    }
  }
  return cards;
}

// Створити чорні карти: +3, +5 (по 2 кожної), ФортУно (8 штук)
function createBlackCards() {
  let cards = [];
  for (let i = 0; i < 2; i++) {
    cards.push({ value: "+3 карти", color: BLACK });
    cards.push({ value: "+5 карт", color: BLACK });
  }
  for (let i = 0; i < 8; i++) {
    cards.push({ value: "ФортУно", color: BLACK });
  }
  return cards;
}

// Згенерувати повну колоду
function generateDeck() {
  const deck = [
    ...createColoredCards(),
    ...createBlackCards()
  ];
  return deck;
}

// Fisher-Yates shuffle
function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Роздати карти гравцям (по 8 кожному), повертає { hands, deck }
function dealCards(deck, playerIds) {
    const hands = {};
    let deckCopy = [...deck];
    for (const playerId of playerIds) {
      hands[playerId] = deckCopy.slice(0, 8);
      deckCopy = deckCopy.slice(8);
    }
    return { hands, deck: deckCopy };
  }
  
  module.exports = {
    generateDeck,
    shuffleDeck,
    dealCards
  };