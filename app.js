/* ==========================================
   DERIV MATCHES & DIFFERS ANALYZER
   NO RANDOM DIGIT SELECTION
========================================== */


/*
   IMPORTANT:

   The analyzer uses REAL collected ticks.

   Math.random() is NOT used anywhere
   to select Matches or Differs digits.
*/


const DERIV_WS =
  "wss://ws.derivws.com/websockets/v3?app_id=1089";


let ws = null;


let activeSymbol = null;


/*
   Store up to 1000 live digits.
*/

let tickData = [];


const MAX_TICKS = 1000;


let reconnectTimer = null;


/* ==========================================
   DOM
========================================== */

const marketSelect =
  document.getElementById("marketSelect");

const connectionStatus =
  document.getElementById("connectionStatus");

const tickCount =
  document.getElementById("tickCount");

const latestDigit =
  document.getElementById("latestDigit");

const ticksElement =
  document.getElementById("ticks");

const frequencyGrid =
  document.getElementById("frequencyGrid");

const analyzeButton =
  document.getElementById("analyzeButton");

const progressFill =
  document.getElementById("progressFill");

const progressText =
  document.getElementById("progressText");

const dataQuality =
  document.getElementById("dataQuality");

const analysisWindow =
  document.getElementById("analysisWindow");

const symbolName =
  document.getElementById("symbolName");

/* ==========================================
   CONNECT
========================================== */

function connect() {

  if (ws) {

    ws.onclose = null;

    ws.close();

  }


  connectionStatus.textContent =
    "● CONNECTING";

  connectionStatus.className =
    "status disconnected";


  ws = new WebSocket(DERIV_WS);


  ws.onopen = () => {

    connectionStatus.textContent =
      "● CONNECTED";

    connectionStatus.className =
      "status connected";


    /*
       Request active symbols first.

       This prevents guessing symbols.
    */

    ws.send(
      JSON.stringify({
        active_symbols: "brief"
      })
    );

  };


  ws.onmessage = event => {

    const data =
      JSON.parse(event.data);


    if (data.error) {

      console.error(data.error.message);

      return;

    }


    if (data.msg_type === "active_symbols") {

      loadVolatilityMarkets(
        data.active_symbols
      );

    }


    if (data.msg_type === "tick") {

      processTick(
        data.tick
      );

    }

  };


  ws.onclose = () => {

    connectionStatus.textContent =
      "● RECONNECTING";

    connectionStatus.className =
      "status disconnected";


    clearTimeout(reconnectTimer);


    reconnectTimer =
      setTimeout(
        connect,
        3000
      );

  };

}


connect();


/* ==========================================
   LOAD REAL VOLATILITY MARKETS
========================================== */

function loadVolatilityMarkets(symbols) {


  /*
    Filter markets using actual
    active_symbols returned by Deriv.

    We avoid hardcoding fake symbols.
  */


  const volatilityMarkets =
    symbols.filter(symbol => {

      const text =
        (
          symbol.display_name +
          " " +
          symbol.symbol
        ).toLowerCase();


      return (
        text.includes("volatility")
      );

    });


  marketSelect.innerHTML = "";


  volatilityMarkets.forEach(market => {

    const option =
      document.createElement("option");


    option.value =
      market.symbol;


    option.textContent =
      market.display_name;


    marketSelect.appendChild(option);

  });


  if (
    volatilityMarkets.length > 0
  ) {

    activeSymbol =
      volatilityMarkets[0].symbol;


    symbolName.textContent =
      activeSymbol;


    subscribeToTicks();

  }

}


/* ==========================================
   CHANGE MARKET
========================================== */

marketSelect.addEventListener(
  "change",
  () => {

    activeSymbol =
      marketSelect.value;


    symbolName.textContent =
      activeSymbol;


    /*
      Clear old market data.

      Never mix digits from
      different Volatility markets.
    */

    tickData = [];


    updateDashboard();


    subscribeToTicks();

  }
);


/* ==========================================
   SUBSCRIBE TO TICKS
========================================== */

function subscribeToTicks() {

  if (
    !ws ||
    ws.readyState !== WebSocket.OPEN
  ) {

    return;

  }


  ws.send(
    JSON.stringify({
      forget_all: "ticks"
    })
  );


  setTimeout(() => {

    ws.send(
      JSON.stringify({
        ticks: activeSymbol,
        subscribe: 1
      })
    );

  }, 300);

}


/* ==========================================
   PROCESS TICK
========================================== */

function processTick(tick) {


  /*
    Deriv quote can contain decimals.

    We use the last digit of the quote.
  */


  const pipSize = Number.isInteger(tick.pip_size)
  ? tick.pip_size
  : 2;

const formattedQuote =
  Number(tick.quote).toFixed(pipSize);

const clean =
  formattedQuote.replace(/\D/g, "");

const digit =
  Number(clean[clean.length - 1]);


  tickData.push({
    digit: digit,
    epoch: tick.epoch,
    quote: tick.quote
  });


  if (
    tickData.length >
    MAX_TICKS
  ) {

    tickData.shift();

  }


  updateDashboard();

}


/* ==========================================
   UPDATE DASHBOARD
========================================== */

function updateDashboard() {

  tickCount.textContent =
    tickData.length;


  analysisWindow.textContent =
    `${tickData.length} TICKS`;


  if (tickData.length > 0) {

    latestDigit.textContent =
      tickData[
        tickData.length - 1
      ].digit;

  }


  updateTicks();

  updateFrequency();

  updateQuality();

}


/* ==========================================
   LIVE TICKS
========================================== */

function updateTicks() {


  if (tickData.length === 0) {

    ticksElement.textContent =
      "Waiting for live ticks...";

    return;

  }


  const latest =
    tickData
      .slice(-60)
      .reverse();


  ticksElement.innerHTML =
    latest.map(item => {

      return `
        <div class="tick">
          ${item.digit}
        </div>
      `;

    }).join("");

}


/* ==========================================
   FREQUENCY
========================================== */

function getCounts(data) {

  const counts =
    Array(10).fill(0);


  data.forEach(item => {

    counts[item.digit]++;

  });


  return counts;

}


function updateFrequency() {

  const counts =
    getCounts(tickData);


  frequencyGrid.innerHTML =
    counts.map(
      (count, digit) => {

        return `
          <div class="frequency-box">

            <div class="frequency-digit">
              ${digit}
            </div>

            <div class="frequency-count">
              ${count} TIMES
            </div>

          </div>
        `;

      }
    ).join("");

}


/* ==========================================
   DATA QUALITY
========================================== */

function updateQuality() {

  const total =
    tickData.length;


  if (total < 30) {

    dataQuality.textContent =
      "LOW";

  }

  else if (total < 100) {

    dataQuality.textContent =
      "BUILDING";

  }

  else if (total < 300) {

    dataQuality.textContent =
      "GOOD";

  }

  else {

    dataQuality.textContent =
      "HIGH";

  }

}


/* ==========================================
   ANALYZE BUTTON
========================================== */

analyzeButton.addEventListener(
  "click",
  startAnalysis
);


/* ==========================================
   1% → 100% ANALYSIS BAR
========================================== */

function startAnalysis() {


  /*
    Require real collected data.
  */

  if (tickData.length < 50) {

    progressText.textContent =
      `NEED MORE DATA: ${tickData.length}/50 TICKS`;

    return;

  }


  analyzeButton.disabled = true;


  let progress = 0;


  progressFill.style.width = "0%";


  progressText.textContent =
    "ANALYZING LIVE DATA... 0%";


  /*
    100 steps × 45 milliseconds
    = approximately 4.5 seconds.
  */

  const timer =
    setInterval(() => {

      progress++;


      progressFill.style.width =
        progress + "%";


      progressText.textContent =
        `ANALYZING LIVE DATA... ${progress}%`;


      if (progress >= 100) {

        clearInterval(timer);


        runStatisticalAnalysis();


        progressText.textContent =
          "ANALYSIS COMPLETE ✓";


        analyzeButton.disabled = false;

      }

    }, 45);

}


/* ==========================================
   WINDOW FREQUENCY
========================================== */

function frequency(digit, size) {

  const window =
    tickData.slice(-size);


  if (window.length === 0) {

    return 0;

  }


  const count =
    window.filter(
      item =>
        item.digit === digit
    ).length;


  return count /
    window.length;

}


/* ==========================================
   TRANSITION PROBABILITY
========================================== */

function transitionProbability(
  targetDigit
) {


  if (tickData.length < 2) {

    return 0;

  }


  const previousDigit =
    tickData[
      tickData.length - 1
    ].digit;


  let previousCount = 0;

  let targetCount = 0;


  for (
    let i = 0;
    i < tickData.length - 1;
    i++
  ) {

    if (
      tickData[i].digit ===
      previousDigit
    ) {

      previousCount++;


      if (
        tickData[i + 1].digit ===
        targetDigit
      ) {

        targetCount++;

      }

    }

  }


  if (previousCount === 0) {

    return 0;

  }


  return targetCount /
    previousCount;

}


/* ==========================================
   DROUGHT
========================================== */

function drought(digit) {


  let count = 0;


  for (
    let i =
      tickData.length - 1;

    i >= 0;

    i--
  ) {

    if (
      tickData[i].digit ===
      digit
    ) {

      break;

    }


    count++;

  }


  return count;

}


/* ==========================================
   APPEARANCES
========================================== */

function appearances(digit) {

  return tickData.filter(
    item =>
      item.digit === digit
  ).length;

}


/* ==========================================
   ANALYZE ONE DIGIT
========================================== */

function analyzeDigit(digit) {


  const f50 =
    frequency(digit, 50);


  const f100 =
    frequency(digit, 100);


  const f250 =
    frequency(digit, 250);


  const f500 =
    frequency(digit, 500);


  const transition =
    transitionProbability(digit);


  const droughtValue =
    drought(digit);


  const totalAppearances =
    appearances(digit);


  /*
    Multi-window average.
  */

  const averageFrequency =
    (
      f50 * 0.40 +
      f100 * 0.25 +
      f250 * 0.20 +
      f500 * 0.15
    );


  /*
    MATCH SCORE

    Deterministic.

    No random number.
  */

  const matchScore =
    (
      averageFrequency * 0.70
    ) +

    (
      transition * 0.30
    );


  /*
    DIFFERS SCORE

    Lower appearance probability
    receives higher avoidance score.
  */

  const differsScore =
    (
      (1 - Math.min(
        averageFrequency * 10,
        1
      )) * 0.65
    ) +

    (
      (1 - Math.min(
        transition * 10,
        1
      )) * 0.20
    ) +

    (
      Math.min(
        droughtValue / 50,
        1
      ) * 0.15
    );


  return {

    digit,

    f50,

    f100,

    f250,

    f500,

    transition,

    drought: droughtValue,

    appearances: totalAppearances,

    matchScore,

    differsScore

  };

}


/* ==========================================
   MAIN STATISTICAL ENGINE
========================================== */

function runStatisticalAnalysis() {


  const results = [];


  for (
    let digit = 0;
    digit <= 9;
    digit++
  ) {

    results.push(
      analyzeDigit(digit)
    );

  }


  /*
    MATCHES

    First prioritize digits that
    actually appeared repeatedly.

    Your requirement:
    digit should have appeared
    at least 3–4 times.

    We use minimum 4 appearances.
  */


  const validMatches =
    results.filter(
      item =>
        item.appearances >= 4
    );


  const matchesCandidates =
    validMatches.length
      ? validMatches
      : results;


  const matches =
    [...matchesCandidates]
      .sort(
        (a, b) =>
          b.matchScore -
          a.matchScore
      )[0];


  /*
    DIFFERS

    Select the strongest
    statistical avoidance candidate.
  */

  const differs =
    [...results]
      .sort(
        (a, b) =>
          b.differsScore -
          a.differsScore
      )[0];


  displayMatches(matches);

  displayDiffers(differs);

}


/* ==========================================
   DISPLAY MATCHES
========================================== */

function displayMatches(data) {


  document.getElementById(
    "matchesDigit"
  ).textContent =
    data.digit;


  document.getElementById(
    "matchesAppearances"
  ).textContent =
    data.appearances;


  document.getElementById(
    "matchesRate"
  ).textContent =
    (
      data.f50 * 100
    ).toFixed(1) + "%";


  document.getElementById(
    "matchesTransition"
  ).textContent =
    (
      data.transition * 100
    ).toFixed(1) + "%";


  document.getElementById(
    "matchesStatus"
  ).textContent =
    "DATA-SELECTED CANDIDATE";


  document.getElementById(
    "matchesReason"
  ).textContent =

    `Digit ${data.digit} was selected from real collected ticks. ` +

    `It appeared ${data.appearances} times in the collected dataset ` +

    `and ranked highest using multi-window frequency and transition analysis.`;

}


/* ==========================================
   DISPLAY DIFFERS
========================================== */

function displayDiffers(data) {


  document.getElementById(
    "differsDigit"
  ).textContent =
    data.digit;


  document.getElementById(
    "differsAppearances"
  ).textContent =
    data.appearances;


  document.getElementById(
    "differsRate"
  ).textContent =
    (
      data.f50 * 100
    ).toFixed(1) + "%";


  document.getElementById(
    "differsTransition"
  ).textContent =
    (
      data.transition * 100
    ).toFixed(1) + "%";


  document.getElementById(
    "differsStatus"
  ).textContent =
    "DATA-SELECTED BARRIER CANDIDATE";


  document.getElementById(
    "differsReason"
  ).textContent =

    `Digit ${data.digit} was selected using low-frequency, ` +

    `transition and drought analysis from the real live ticks. ` +

    `It has ${data.appearances} appearances in the collected dataset.`;

}
  font-size: 13px;

}


.connected {

  color: #00e676;

}


.disconnected {

  color: #ff5252;

}


.panel {

  background: #0d1117;

  border: 1px solid #26313d;

  padding: 18px;

  margin-bottom: 15px;

}


.panel h2 {

  margin-top: 0;

  font-size: 15px;

}


select {

  width: 100%;

  padding: 14px;

  background: #161b22;

  color: white;

  border: 1px solid #30363d;

  font-size: 15px;

}


.market-info {

  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 10px;

  margin-top: 15px;

}


.market-info div {

  background: #161b22;

  padding: 12px;

}


.market-info span {

  display: block;

  font-size: 10px;

  color: #8b949e;

}


.market-info strong {

  display: block;

  margin-top: 6px;

  font-size: 18px;

}


.ticks {

  display: flex;

  flex-wrap: wrap;

  gap: 7px;

  min-height: 50px;

}


.tick {

  width: 38px;

  height: 38px;

  display: flex;

  justify-content: center;

  align-items: center;

  background: #161b22;

  border: 1px solid #30363d;

  font-size: 18px;

  font-weight: bold;

}


.description {

  color: #8b949e;

  font-size: 13px;

}


.analyze-button {

  width: 100%;

  padding: 18px;

  margin-top: 15px;

  border: none;

  background: #00c853;

  color: #000;

  font-size: 15px;

  font-weight: bold;

  cursor: pointer;

}


.analyze-button:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}


.progress-container {

  margin-top: 20px;

}


.progress-bar {

  height: 20px;

  background: #161b22;

  border: 1px solid #30363d;

}


.progress-fill {

  width: 0%;

  height: 100%;

  background: #00e676;

  transition: width 0.05s linear;

}


.progress-text {

  text-align: center;

  margin-top: 8px;

  font-weight: bold;

  color: #00e676;

}


.results-grid {

  display: grid;

  grid-template-columns: repeat(2, 1fr);

  gap: 15px;

  margin-bottom: 15px;

}


.result-card {

  background: #0d1117;

  padding: 20px;

  border: 1px solid #26313d;

}


.matches {

  border-top: 4px solid #00e676;

}


.differs {

  border-top: 4px solid #ff9800;

}


.result-digit {

  font-size: 100px;

  font-weight: bold;

  text-align: center;

}


.result-status {

  text-align: center;

  font-weight: bold;

  margin-bottom: 15px;

}


.result-card p {

  color: #a8b0b9;

  min-height: 60px;

  font-size: 13px;

}


.stats {

  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 7px;

}


.stats div {

  background: #161b22;

  padding: 10px;

}


.stats span {

  display: block;

  font-size: 9px;

  color: #8b949e;

}


.stats strong {

  display: block;

  margin-top: 5px;

}


.frequency-grid {

  display: grid;

  grid-template-columns: repeat(10, 1fr);

  gap: 7px;

}


.frequency-box {

  text-align: center;

  background: #161b22;

  border: 1px solid #30363d;

  padding: 12px 5px;

}


.frequency-digit {

  font-size: 22px;

  font-weight: bold;

}


.frequency-count {

  color: #8b949e;

  font-size: 11px;

}


.quality {

  display: grid;

  grid-template-columns: repeat(3, 1fr);

  gap: 10px;

}


.quality div {

  background: #161b22;

  padding: 12px;

}


.quality span {

  display: block;

  font-size: 10px;

  color: #8b949e;

}


.quality strong {

  display: block;

  margin-top: 5px;

}


@media (max-width: 700px) {

  header {

    flex-direction: column;

    align-items: flex-start;

  }


  .market-info {

    grid-template-columns: 1fr;

  }


  .results-grid {

    grid-template-columns: 1fr;

  }


  .frequency-grid {

    grid-template-columns: repeat(5, 1fr);

  }


  .quality {

    grid-template-columns: 1fr;

  }

}
