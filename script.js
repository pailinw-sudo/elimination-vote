/*
 * script.js
 *
 * This file contains all of the client‑side logic for the elimination
 * voting application. It manages state via localStorage, renders the UI
 * dynamically and wires up all event handlers for voting, administration
 * and round management.
 */

(function () {
  const DATA_KEY = 'voteData';
  const ADMIN_PASSWORD = 'admin123';
  // Flag indicating whether the admin panel is currently displayed
  let adminLoggedIn = false;
  // Flash message object used to display temporary notifications
  let flashMessage = null;

  /**
   * Default list of players as supplied by the user. Used on first run to
   * initialise the application state.
   */
  const DEFAULT_PLAYERS = [
    "Chow Peerapon",
    "Diow Tanawat",
    "First Sittiwit",
    "Gain Rachavit",
    "Gift Panpaphanan",
    "Gift Pornpatch",
    "Ice Chatdaroon",
    "Krit Suppawit",
    "Va Tunva",
    "Gna Jasmin",
    "Iryn Sutha",
    "Jane Janejira",
    "Kan Patarakan",
    "Nas Patranit",
    "Ping Tanaboon",
    "Puynun Kitsadaporn",
    "Thoongpaeng Thanawan",
    "Title Nonthawat",
    "Waan Chonticha",
    "Aom Pitchakorn",
    "Arm Boonyawat",
    "Arnold Teerawat",
    "Benz Jiraphat",
    "Giffarine Pattarada",
    "Nad Tanin",
    "Petch Thanarut",
    "Prem Prem",
    "Ran Saran",
    "Gift Phasa",
    "Jan Sutamma",
    "Joey Puwanai",
    "Many Asama",
    "Nampueng",
    "Nook Monraedee",
    "P.Fhon Patteera",
    "Ticha Ticha",
    "Toey Thanawat",
    "Baimee Phatsarin",
    "Cheese Kantika",
    "Fendee Thanarin",
    "Kratae Ratchaneewan",
    "Name Pannatorn",
    "Palm Piyawat",
    "Tangmo Piyapat",
    "Toeyhorm Niratchaporn",
    "Whan Pichanan",
    "Ake Suppanat",
    "Baisri Pitchayaphon",
    "Champ Chayutpong",
    "Dew Sirada",
    "Grip Thanabut",
    "Hun Tuanhannan",
    "Namkhing Siripat",
    "Tum Thaweewat",
  ];

  /**
   * Load state from localStorage. If no data is present, a new structure is
   * created with default players and initial values. Persisted state has
   * the following structure:
   *
   * {
   *   players: [ { name: string, votes: { day1: number, day2: number, day3: number } }, ... ],
   *   currentDay: number (1..3),
   *   history: { day1: Array<{name,votes}>, day2: Array, day3: Array }
   * }
   */
  function loadState() {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Ensure any new keys are present when loading older state
        if (!parsed.status) {
          parsed.status = {
            day1: { closed: false, published: false },
            day2: { closed: false, published: false },
            day3: { closed: false, published: false },
          };
        }
        return parsed;
      } catch (e) {
        console.warn('Failed to parse stored data, reinitialising.', e);
      }
    }
    // Initialise new state
    const players = DEFAULT_PLAYERS.map((name) => ({
      name,
      votes: { day1: 0, day2: 0, day3: 0 },
    }));
    const state = {
      players,
      currentDay: 1,
      history: { day1: [], day2: [], day3: [] },
      status: {
        day1: { closed: false, published: false },
        day2: { closed: false, published: false },
        day3: { closed: false, published: false },
      },
    };
    saveState(state);
    return state;
  }

  /**
   * Persist the current state to localStorage.
   * @param {Object} state
   */
  function saveState(state) {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
  }

  /**
   * Compute the top five players for the given day key ("day1", "day2", or
   * "day3"). Returns an array of { name, votes } sorted by vote count in
   * descending order.
   * @param {Object} state
   * @param {string} dayKey
   */
  function getTopFive(state, dayKey) {
    const sorted = state.players
      .slice()
      .sort((a, b) => b.votes[dayKey] - a.votes[dayKey]);
    return sorted.slice(0, 5).map((p) => ({ name: p.name, votes: p.votes[dayKey] }));
  }

  /**
   * Check whether the user has already voted in the current round.
   * Uses a simple flag stored in localStorage keyed by the current day (e.g.
   * "voted_day1").
   * @param {number} currentDay
   */
  function hasVoted(currentDay) {
    return localStorage.getItem(`voted_day${currentDay}`) === 'true';
  }

  /**
   * Mark the user as having voted in the current round. The flag persists
   * across sessions to prevent multiple submissions from the same browser.
   * @param {number} currentDay
   */
  function setVoted(currentDay) {
    localStorage.setItem(`voted_day${currentDay}`, 'true');
  }

  /**
   * Reset vote flags for all rounds. Called when advancing to the next round
   * so that users can vote again.
   */
  function clearAllVoteFlags() {
    localStorage.removeItem('voted_day1');
    localStorage.removeItem('voted_day2');
    localStorage.removeItem('voted_day3');
  }

  /**
   * Render the entire application based on the current state and admin login
   * status. Replaces the innerHTML of the root container and attaches
   * appropriate event handlers.
   */
  function renderApp() {
    const state = loadState();
    const container = document.getElementById('app');
    let html = '';

    // Build flash message if present
    if (flashMessage) {
      html += `<div class="message ${flashMessage.type}">${flashMessage.text}</div>`;
      // Clear the flash message after displaying once
      flashMessage = null;
    }

    if (!adminLoggedIn) {
      // USER VIEW
      const dayKey = `day${state.currentDay}`;
      const roundStatus = state.status[dayKey] || { closed: false, published: false };
      html += `<div class="card">`;
      if (!roundStatus.closed) {
        // Voting is open
        if (hasVoted(state.currentDay)) {
          html += `<p>You have already voted for Day ${state.currentDay}. Thank you!`;
          if (roundStatus.published) {
            html += ` You can see the results below.`;
          } else {
            html += ` Results will be available once the admin publishes them.`;
          }
          html += `</p>`;
        } else {
          html += `<p>Select exactly <strong>3</strong> names you would like to vote out:</p>`;
          html += `<form id="voteForm">
              <ul>`;
          state.players.forEach((player, index) => {
            html += `<li class="checkbox">
                    <input type="checkbox" id="cb${index}" name="player" value="${encodeURIComponent(player.name)}">
                    <label for="cb${index}">${player.name}</label>
                </li>`;
          });
          html += `</ul>
              <input type="submit" value="Submit Votes">
          </form>`;
        }
      } else {
        // Voting closed
        html += `<p>Voting for Day ${state.currentDay} is closed.`;
        if (roundStatus.published) {
          html += ` The results have been published below.`;
        } else {
          html += ` Results will be published soon.`;
        }
        html += `</p>`;
      }
      html += `</div>`;

      // Show results only if published
      if (roundStatus.published) {
        const topFive = getTopFive(state, dayKey);
        html += `<div class="card">
                <h2>Top 5 Standings - Day ${state.currentDay}</h2>`;
        if (topFive.length > 0 && topFive.some((item) => item.votes > 0)) {
          html += `<table>
                        <thead>
                            <tr><th>Rank</th><th>Name</th><th>Votes</th></tr>
                        </thead>
                        <tbody>`;
          topFive.forEach((item, idx) => {
            html += `<tr><td>${idx + 1}</td><td>${item.name}</td><td>${item.votes}</td></tr>`;
          });
          html += `</tbody></table>`;
        } else {
          html += `<p>No votes were recorded for this round.</p>`;
        }
        html += `</div>`;
      }

      // History link and admin login button
      html += `<div class="card" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button id="showHistoryBtn">View History</button>
              <button id="adminLoginBtn">Admin Login</button>
          </div>`;

      container.innerHTML = html;

      // Attach event listeners
      const voteForm = document.getElementById('voteForm');
      if (voteForm) {
        voteForm.addEventListener('submit', function (e) {
          e.preventDefault();
          const selected = Array.from(voteForm.querySelectorAll('input[name="player"]:checked')).map((cb) => decodeURIComponent(cb.value));
          if (selected.length !== 3) {
            flashMessage = { type: 'error', text: 'Please select exactly 3 names.' };
            renderApp();
            return;
          }
          // update votes
          selected.forEach((name) => {
            const player = state.players.find((p) => p.name === name);
            if (player) {
              player.votes[dayKey] += 1;
            }
          });
          saveState(state);
          setVoted(state.currentDay);
          flashMessage = { type: 'success', text: 'Thank you for voting!' };
          renderApp();
        });
      }
      const historyBtn = document.getElementById('showHistoryBtn');
      historyBtn.addEventListener('click', function () {
        renderHistoryView(state);
      });
      const adminBtn = document.getElementById('adminLoginBtn');
      adminBtn.addEventListener('click', function () {
          handleAdminLogin();
      });
    } else {
      // ADMIN VIEW
      const dayKeyAdmin = `day${state.currentDay}`;
      const roundStatusAdmin = state.status[dayKeyAdmin] || { closed: false, published: false };
      // Panel card
      html += `<div class="card">
            <h2>Admin Panel - Day ${state.currentDay}</h2>
            <p>Use the controls below to manage players and rounds.</p>`;
      // Add player controls
      html += `<div style="margin-top:10px;">
                <label style="display:block;margin-bottom:5px;">Add Player:</label>
                <input type="text" id="newPlayerName" placeholder="New player name">
                <button id="addPlayerBtn">Add</button>
            </div>`;
      // Delete player controls
      html += `<div style="margin-top:20px;">
                <label style="display:block;margin-bottom:5px;">Delete Player:</label>
                <select id="deletePlayerSelect">
                    ${state.players
                      .map((p) => `<option value="${encodeURIComponent(p.name)}">${p.name}</option>`) .join('')}
                </select>
                <button id="deletePlayerBtn">Delete</button>
            </div>`;
      // Close / Publish controls
      html += `<div style="margin-top:20px;">`;
      if (!roundStatusAdmin.closed) {
        html += `<button id="closeVotingBtn">Close Voting</button>`;
      } else if (roundStatusAdmin.closed && !roundStatusAdmin.published) {
        html += `<button id="publishResultsBtn">Publish Results</button>`;
      } else if (roundStatusAdmin.published) {
        html += `<p style="color:#888;">Results have been published.</p>`;
      }
      html += `</div>`;
      // Reset button
      html += `<div style="margin-top:20px;">
                <button id="resetRoundBtn">Reset Round &amp; Archive Results</button>
                <p style="margin-top:5px; font-size:0.9em; color:#888;">Resetting will save the top 5 for the current day and start the next round. After Day 3, votes for Day 3 will simply be cleared.</p>
            </div>`;

      // Section for wiping results of a specific day
      html += `<div style="margin-top:20px;">
                <label style="display:block;margin-bottom:5px;">Wipe Day Results:</label>
                <select id="wipeDaySelect">
                    <option value="day1">Day 1</option>
                    <option value="day2">Day 2</option>
                    <option value="day3">Day 3</option>
                </select>
                <button id="wipeDayBtn">Wipe</button>
                <p style="margin-top:5px; font-size:0.9em; color:#888;">This will remove all votes and history for the selected day.</p>
            </div>`;
      // Logout/Back buttons
      html += `<div style="margin-top:20px;">
                <button id="adminLogoutBtn">Log out</button>
                <button id="returnToVote" style="margin-left:10px;">Back to Voting</button>
            </div>`;
      html += `</div>`;
      // Results card for admin (always visible)
      const adminTopFive = getTopFive(state, dayKeyAdmin);
      html += `<div class="card">
                <h2>Top 5 Standings - Day ${state.currentDay} (Admin View)</h2>`;
      if (adminTopFive.length > 0 && adminTopFive.some((item) => item.votes > 0)) {
        html += `<table>
                        <thead><tr><th>Rank</th><th>Name</th><th>Votes</th></tr></thead>
                        <tbody>`;
        adminTopFive.forEach((item, idx) => {
          html += `<tr><td>${idx + 1}</td><td>${item.name}</td><td>${item.votes}</td></tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<p>No votes yet for this day.</p>`;
      }
      html += `</div>`;
      // History section
      html += `<div class="card">
                <h2>History</h2>`;
      ['day1','day2','day3'].forEach((dKey) => {
        const results = state.history[dKey];
        html += `<h3 style="margin-top:15px;">${dKey.replace('day','Day ')}</h3>`;
        if (results && results.length > 0) {
          html += `<table>
                            <thead><tr><th>Rank</th><th>Name</th><th>Votes</th></tr></thead>
                            <tbody>`;
          results.forEach((item, idx) => {
            html += `<tr><td>${idx + 1}</td><td>${item.name}</td><td>${item.votes}</td></tr>`;
          });
          html += `</tbody></table>`;
        } else {
          html += `<p>No results saved.</p>`;
        }
      });
      html += `</div>`;
      container.innerHTML = html;
      // Attach admin event listeners
      document.getElementById('addPlayerBtn').addEventListener('click', function () {
        const input = document.getElementById('newPlayerName');
        const name = input.value.trim();
        if (!name) {
          flashMessage = { type: 'error', text: 'Please enter a name to add.' };
          renderApp();
          return;
        }
        // Check if player already exists
        if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          flashMessage = { type: 'error', text: 'Player already exists.' };
        } else {
          state.players.push({ name, votes: { day1: 0, day2: 0, day3: 0 } });
          saveState(state);
          flashMessage = { type: 'success', text: `Added ${name}.` };
        }
        input.value = '';
        renderApp();
      });
      document.getElementById('deletePlayerBtn').addEventListener('click', function () {
        const select = document.getElementById('deletePlayerSelect');
        const name = decodeURIComponent(select.value);
        const idx = state.players.findIndex((p) => p.name === name);
        if (idx >= 0) {
          state.players.splice(idx, 1);
          saveState(state);
          flashMessage = { type: 'success', text: `Deleted ${name}.` };
        } else {
          flashMessage = { type: 'error', text: 'Player not found.' };
        }
        renderApp();
      });
      // Close voting button
      const closeBtn = document.getElementById('closeVotingBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          if (!confirm('Are you sure you want to close voting for this day? Users will no longer be able to vote.')) return;
          state.status[dayKeyAdmin] = state.status[dayKeyAdmin] || { closed: false, published: false };
          state.status[dayKeyAdmin].closed = true;
          saveState(state);
          flashMessage = { type: 'success', text: 'Voting closed for this round.' };
          renderApp();
        });
      }
      // Publish results button
      const publishBtn = document.getElementById('publishResultsBtn');
      if (publishBtn) {
        publishBtn.addEventListener('click', function () {
          state.status[dayKeyAdmin] = state.status[dayKeyAdmin] || { closed: false, published: false };
          state.status[dayKeyAdmin].published = true;
          saveState(state);
          flashMessage = { type: 'success', text: 'Results published for this round.' };
          renderApp();
        });
      }
      document.getElementById('resetRoundBtn').addEventListener('click', function () {
        if (!confirm('Are you sure you want to reset the current round? This will save the top 5 and start a new day.')) {
          return;
        }
        // Archive current top five
        const dKey = `day${state.currentDay}`;
        const topFive = getTopFive(state, dKey);
        state.history[dKey] = topFive;
        // Mark this day as closed & published so results remain visible in history
        state.status[dKey] = state.status[dKey] || { closed: false, published: false };
        state.status[dKey].closed = true;
        state.status[dKey].published = true;
        // Advance day or clear votes if last day
        if (state.currentDay < 3) {
          state.currentDay += 1;
          const nextDayKey = `day${state.currentDay}`;
          // Ensure votes for next day exist and are zero
          state.players.forEach((p) => {
            p.votes[nextDayKey] = 0;
          });
          // Reset next day status
          state.status[nextDayKey] = { closed: false, published: false };
        } else {
          // Reset votes on final day
          state.players.forEach((p) => {
            p.votes[dKey] = 0;
          });
        }
        // Clear vote flags so users can vote again
        clearAllVoteFlags();
        saveState(state);
        flashMessage = { type: 'success', text: 'Round reset and top 5 saved.' };
        renderApp();
      });
      document.getElementById('adminLogoutBtn').addEventListener('click', function () {
        adminLoggedIn = false;
        flashMessage = { type: 'success', text: 'Logged out of admin.' };
        renderApp();
      });
      document.getElementById('returnToVote').addEventListener('click', function () {
        adminLoggedIn = false;
        renderApp();
      });

      // Event handler for wiping day results
      document.getElementById('wipeDayBtn').addEventListener('click', function () {
        const select = document.getElementById('wipeDaySelect');
        const selectedDay = select.value; // e.g. "day1"
        if (!selectedDay) return;
        if (!confirm(`Are you sure you want to wipe all votes and history for ${selectedDay.replace('day','Day ')}? This action cannot be undone.`)) {
          return;
        }
        // Clear votes for that day
        state.players.forEach((p) => {
          p.votes[selectedDay] = 0;
        });
        // Clear history for that day
        state.history[selectedDay] = [];
        // Reset status for that day
        state.status[selectedDay] = { closed: false, published: false };
        // Clear vote flags so users can vote again for that day
        localStorage.removeItem(`voted_${selectedDay}`);
        saveState(state);
        flashMessage = { type: 'success', text: `${selectedDay.replace('day','Day ')} results wiped successfully.` };
        renderApp();
      });
    }
  }

  /**
   * Render the history view for regular users. Provides a way back to the
   * main voting screen.
   * @param {Object} state
   */
  function renderHistoryView(state) {
    const container = document.getElementById('app');
    let html = '';
    html += `<div class="card">
            <h2>History</h2>`;
    ['day1','day2','day3'].forEach((dayKey) => {
      const results = state.history[dayKey];
      html += `<h3 style="margin-top:15px;">${dayKey.replace('day','Day ')}</h3>`;
      if (results && results.length > 0) {
        html += `<table>
                    <thead><tr><th>Rank</th><th>Name</th><th>Votes</th></tr></thead>
                    <tbody>`;
        results.forEach((item, idx) => {
          html += `<tr><td>${idx + 1}</td><td>${item.name}</td><td>${item.votes}</td></tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<p>No results saved.</p>`;
      }
    });
    html += `<button id="backFromHistory" style="margin-top:20px;">Back to Voting</button>`;
    html += `</div>`;
    container.innerHTML = html;
    document.getElementById('backFromHistory').addEventListener('click', function () {
      renderApp();
    });
  }

  /**
   * Prompt the user for the admin password and if correct, switch to admin
   * mode. A failed attempt will result in a flash message.
   */
  function handleAdminLogin() {
    const password = prompt('Enter admin password:');
    if (password === null) return; // cancelled
    if (password === ADMIN_PASSWORD) {
      adminLoggedIn = true;
      flashMessage = { type: 'success', text: 'Successfully logged in as admin.' };
    } else {
      flashMessage = { type: 'error', text: 'Incorrect password.' };
    }
    renderApp();
  }

  // Initial render on page load
  document.addEventListener('DOMContentLoaded', function () {
    renderApp();
  });
})();