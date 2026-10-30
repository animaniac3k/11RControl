/**
 * Avid Eleven Rack — Live Performance Controller
 * Clean, direct MIDI implementation based on official Avid Table 12 CCs.
 * All controls visible in a single dashboard with 2-way MIDI tracking.
 */

// ============================================================================
// 1. OFFICIAL ELEVEN RACK TABLE 12 MIDI CC MAP
// ============================================================================
const CC_MAP = {
  // Global & Utility
  wah_pedal: 4,          // Wah Pedal Sweep (0-127)
  rig_volume: 7,         // Rig Volume (0-127)
  exp_pedal: 11,         // Multi-FX Expression Control (0-127)
  bank_select: 0,        // Bank Select (0 = User A-Z, 1 = Factory a-z)
  tap_tempo: 64,         // Tap Tempo Trigger
  rig_input_guitar: 65,  // Rig Input (0-63 = Guitar True-Z, 64-127 = Mic)
  tuner: 69,             // Chromatic Tuner / Mute (0-63 = Off, 64-127 = On)

  // Stomp / Block Bypass Switches (0-63 = Bypassed, 64-127 = Engaged)
  bypass_wah: 43,
  bypass_dist: 25,
  bypass_mod: 50,
  bypass_delay: 28,
  bypass_reverb: 36,
  bypass_fx1: 63,
  bypass_fx2: 86,
  bypass_fxloop: 107,
  bypass_amp: 111,
  bypass_cab: 92,

  // Amplifier Tone Stack & Output (Continuous Settings 0-127)
  amp_p1: 14,   // Gain / Volume 1
  amp_p2: 15,   // Bass
  amp_p3: 16,   // Middle
  amp_p4: 17,   // Treble
  amp_p5: 21,   // Presence
  amp_p6: 10,   // Master Volume
  amp_p11: 22,  // Amp Output Level
  cab_p1: 26,   // Speaker Breakup (0-10.0)

  // Distortion Parameters
  dist_p1: 78,  // Drive / Gain
  dist_p2: 79,  // Tone
  dist_p3: 80,  // Level / Volume

  // Modulation Parameters
  mod_p1: 62,   // Rate / Speed
  mod_p2: 52,   // Depth / Intensity
  mod_p3: 53,   // Mix / Level
  mod_p4: 54,   // Feedback / Tone

  // Delay Parameters
  delay_p1: 71, // Delay Time
  delay_p2: 72, // Feedback
  delay_p3: 73, // Mix Level
  delay_p4: 88, // Echo Tone / High Cut

  // Reverb Parameters
  reverb_p1: 74, // Reverb Mix
  reverb_p2: 75, // Decay Time
  reverb_p3: 76, // Tone

  // FX 1 Parameters (Comp / EQ / Pitch)
  fx1_p1: 20,   // Parameter 1 (Gain / Sens)
  fx1_p2: 42,   // Parameter 2 (Tone / Ratio)
  fx1_p3: 60,   // Parameter 3 (Level / Attack)

  // FX 2 Parameters (Filter / Chorus / Flanger)
  fx2_p1: 114,  // Parameter 1 (Speed / Resonance)
  fx2_p2: 115,  // Parameter 2 (Depth / Range)
  fx2_p3: 116,  // Parameter 3 (Mix / Level)

  // FX Loop
  fxloop_p3: 110 // FX Loop Mix
};

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================
const state = {
  theme: 'orange',
  midiAccess: null,
  midiOut: null,
  midiIn: null,
  midiChannel: 0, // 0 = Ch 1

  // Rig Switcher State
  bankType: 'USER', // 'USER' (CC0=0) or 'FACTORY' (CC0=1)
  bankIndex: 0,     // 0 = A, 1 = B ... 25 = Z
  slotIndex: 0,     // 0..3 -> Rig 1..4
  customRigNames: {},

  // Block Bypasses
  blocks: {
    amp: true,
    cab: true,
    dist: true,
    mod: false,
    delay: true,
    reverb: true,
    fx1: false,
    fx2: false,
    fxloop: false,
    wah: false
  },

  // Active Continuous Values (0-127)
  params: {
    rig_volume: 102,
    wah_pedal: 0,
    exp_pedal: 64,

    // Amp
    amp_p1: 89,   // Gain (7.0)
    amp_p2: 70,   // Bass (5.5)
    amp_p3: 76,   // Mid (6.0)
    amp_p4: 83,   // Treble (6.5)
    amp_p5: 64,   // Presence (5.0)
    amp_p6: 95,   // Master (7.5)
    amp_p11: 102, // Amp Out (8.0)
    cab_p1: 38,   // Breakup (3.0)

    // Distortion
    dist_p1: 76,
    dist_p2: 64,
    dist_p3: 89,

    // Mod
    mod_p1: 57,
    mod_p2: 76,
    mod_p3: 64,
    mod_p4: 38,

    // Delay
    delay_p1: 64,
    delay_p2: 51,
    delay_p3: 45,
    delay_p4: 76,

    // Reverb
    reverb_p1: 38,
    reverb_p2: 70,
    reverb_p3: 76,

    // FX 1
    fx1_p1: 64,
    fx1_p2: 64,
    fx1_p3: 76,

    // FX 2
    fx2_p1: 64,
    fx2_p2: 64,
    fx2_p3: 76,

    // FX Loop
    fxloop_p3: 64
  },

  tunerActive: false
};

// ============================================================================
// 3. WEB MIDI ENGINE (TX & RX)
// ============================================================================
async function initWebMIDI() {
  const statusDot = document.getElementById('midi-status-dot');
  const statusText = document.getElementById('midi-status-text');

  if (!navigator.requestMIDIAccess) {
    statusDot.className = 'status-dot error';
    statusText.textContent = 'Use Chrome or Edge for Web MIDI';
    logMidi('info', 'Web MIDI not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    return;
  }

  try {
    state.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    state.midiAccess.onstatechange = populateMidiDevices;
    populateMidiDevices();
  } catch (err) {
    statusDot.className = 'status-dot error';
    statusText.textContent = 'MIDI Access Denied';
    logMidi('info', `Web MIDI request error: ${err.message}`);
  }
}

function populateMidiDevices() {
  if (!state.midiAccess) return;

  const outSelect = document.getElementById('midi-out-select');
  const inSelect = document.getElementById('midi-in-select');
  const statusDot = document.getElementById('midi-status-dot');
  const statusText = document.getElementById('midi-status-text');

  const prevOut = outSelect.value;
  const prevIn = inSelect.value;

  outSelect.innerHTML = '<option value="">-- No MIDI Output --</option>';
  inSelect.innerHTML = '<option value="">-- No MIDI Input --</option>';

  let autoOut = '';
  let autoIn = '';

  for (const out of state.midiAccess.outputs.values()) {
    const opt = document.createElement('option');
    opt.value = out.id;
    opt.textContent = out.name || `MIDI Out (${out.id})`;
    outSelect.appendChild(opt);
    if (/eleven|avid|digidesign|11r/i.test(out.name)) autoOut = out.id;
  }

  for (const input of state.midiAccess.inputs.values()) {
    const opt = document.createElement('option');
    opt.value = input.id;
    opt.textContent = input.name || `MIDI In (${input.id})`;
    inSelect.appendChild(opt);
    if (/eleven|avid|digidesign|11r/i.test(input.name)) autoIn = input.id;
  }

  if (prevOut && state.midiAccess.outputs.has(prevOut)) outSelect.value = prevOut;
  else if (autoOut) outSelect.value = autoOut;
  else if (state.midiAccess.outputs.size === 1) outSelect.value = Array.from(state.midiAccess.outputs.keys())[0];

  if (prevIn && state.midiAccess.inputs.has(prevIn)) inSelect.value = prevIn;
  else if (autoIn) inSelect.value = autoIn;
  else if (state.midiAccess.inputs.size === 1) inSelect.value = Array.from(state.midiAccess.inputs.keys())[0];

  bindMidiPorts();

  if (state.midiOut) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = `Connected: ${state.midiOut.name}${state.midiIn ? ' (2-Way)' : ''}`;
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = state.midiAccess.outputs.size > 0 ? 'Select MIDI Out' : 'No MIDI Devices Found';
  }
}

function bindMidiPorts() {
  if (!state.midiAccess) return;
  const outId = document.getElementById('midi-out-select').value;
  const inId = document.getElementById('midi-in-select').value;

  state.midiOut = outId ? state.midiAccess.outputs.get(outId) : null;

  if (state.midiIn) state.midiIn.onmidimessage = null;
  state.midiIn = inId ? state.midiAccess.inputs.get(inId) : null;
  if (state.midiIn) state.midiIn.onmidimessage = handleIncomingMidi;

  const statusDot = document.getElementById('midi-status-dot');
  const statusText = document.getElementById('midi-status-text');

  if (state.midiOut) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = `Connected: ${state.midiOut.name}${state.midiIn ? ' (2-Way)' : ''}`;
    logMidi('info', `MIDI Ready: TX="${state.midiOut.name}" | RX="${state.midiIn ? state.midiIn.name : 'None'}" (Ch ${state.midiChannel + 1})`);
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = 'No Output Selected';
  }
}

function sendMidiCC(ccNumber, value, label = '') {
  const cc = Math.max(0, Math.min(127, Math.round(Number(ccNumber))));
  const val = Math.max(0, Math.min(127, Math.round(Number(value))));
  const status = 0xB0 | (state.midiChannel & 0x0F);

  if (state.midiOut) {
    try {
      state.midiOut.send([status, cc, val]);
    } catch (e) {
      logMidi('info', `TX Error: ${e.message}`);
    }
  }

  logMidi('tx', `CC #${String(cc).padStart(3, ' ')} = ${String(val).padStart(3, ' ')} ${label ? `(${label})` : ''}`);
}

function sendMidiPC(pcNumber, bankType = state.bankType) {
  const pc = Math.max(0, Math.min(127, Math.round(Number(pcNumber))));
  const ccStatus = 0xB0 | (state.midiChannel & 0x0F);
  const pcStatus = 0xC0 | (state.midiChannel & 0x0F);
  const bankVal = bankType === 'FACTORY' ? 1 : 0;

  if (state.midiOut) {
    try {
      // CC 0 (Bank Select) followed by Program Change
      state.midiOut.send([ccStatus, CC_MAP.bank_select, bankVal]);
      state.midiOut.send([pcStatus, pc]);
      // Explicitly lock Rig Input to Guitar (True-Z)
      state.midiOut.send([ccStatus, CC_MAP.rig_input_guitar, 0]);
    } catch (e) {
      logMidi('info', `PC Error: ${e.message}`);
    }
  }

  const letter = bankType === 'USER' ? String.fromCharCode(65 + state.bankIndex) : String.fromCharCode(97 + state.bankIndex);
  const slotName = `${letter}${state.slotIndex + 1}`;
  logMidi('tx', `Bank=${bankType} -> PC #${String(pc).padStart(3, '0')} (${slotName}) | Input: Guitar`);
}

function handleIncomingMidi(event) {
  if (!event.data || event.data.length < 2) return;
  const [status, data1, data2] = event.data;
  const cmd = status & 0xF0;
  const ch = (status & 0x0F) + 1;

  if (cmd === 0xB0) {
    logMidi('rx', `CC #${String(data1).padStart(3, ' ')} = ${String(data2).padStart(3, ' ')} (Ch ${ch})`);
    syncIncomingCC(data1, data2);
  } else if (cmd === 0xC0) {
    logMidi('rx', `Program Change #${String(data1).padStart(3, '0')} (Ch ${ch})`);
    const bank = Math.floor(data1 / 4);
    const slot = data1 % 4;
    if (bank >= 0 && bank < 26) {
      state.bankIndex = bank;
      state.slotIndex = slot;
      renderRigBar();
    }
  }
}

function syncIncomingCC(cc, val) {
  // 1. Bank Select
  if (cc === CC_MAP.bank_select) {
    state.bankType = val >= 1 ? 'FACTORY' : 'USER';
    renderRigBar();
    return;
  }

  // 2. Tuner
  if (cc === CC_MAP.tuner) {
    state.tunerActive = val >= 64;
    renderTuner();
    return;
  }

  // 3. Block Bypasses
  let matched = false;
  const bypassMap = {
    [CC_MAP.bypass_amp]: 'amp',
    [CC_MAP.bypass_cab]: 'cab',
    [CC_MAP.bypass_dist]: 'dist',
    [CC_MAP.bypass_mod]: 'mod',
    [CC_MAP.bypass_delay]: 'delay',
    [CC_MAP.bypass_reverb]: 'reverb',
    [CC_MAP.bypass_fx1]: 'fx1',
    [CC_MAP.bypass_fx2]: 'fx2',
    [CC_MAP.bypass_fxloop]: 'fxloop',
    [CC_MAP.bypass_wah]: 'wah'
  };

  if (bypassMap[cc]) {
    const block = bypassMap[cc];
    state.blocks[block] = val >= 64;
    renderBypasses();
    matched = true;
  }

  // 4. Continuous Parameters
  for (const [paramKey, mappedCC] of Object.entries(CC_MAP)) {
    if (mappedCC === cc && paramKey in state.params) {
      state.params[paramKey] = val;
      updateKnobDOM(paramKey, val);
      if (paramKey === 'wah_pedal' || paramKey === 'rig_volume' || paramKey === 'exp_pedal') {
        renderPedals();
      }
      matched = true;
    }
  }
}

function logMidi(type, message) {
  const list = document.getElementById('midi-log-list');
  if (!list) return;
  const item = document.createElement('div');
  item.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  item.textContent = `[${time}] ${message}`;
  list.appendChild(item);

  while (list.children.length > 50) {
    list.removeChild(list.firstChild);
  }
  list.scrollTop = list.scrollHeight;
}

// ============================================================================
// 4. UI RENDERING & DIRECT KNOB UPDATES
// ============================================================================
function formatParamValue(paramKey, val) {
  if (paramKey === 'delay_p1') {
    // 50ms - 1000ms
    const ms = Math.round(50 + (val / 127) * 950);
    return `${ms}ms`;
  }
  return ((val / 127) * 10).toFixed(1);
}

function updateKnobDOM(paramKey, val) {
  const norm = Math.max(0, Math.min(1, val / 127));
  const deg = Math.round(norm * 270);
  const rot = -135 + deg;

  const ring = document.getElementById(`ring-${paramKey}`);
  const knob = document.getElementById(`knob-${paramKey}`);
  const readout = document.getElementById(`val-${paramKey}`);

  if (ring) ring.style.setProperty('--knob-deg', `${deg}deg`);
  if (knob) knob.style.setProperty('--knob-rot', `${rot}deg`);
  if (readout) readout.textContent = formatParamValue(paramKey, val);
}

function renderAllKnobs() {
  for (const [key, val] of Object.entries(state.params)) {
    updateKnobDOM(key, val);
  }
}

function renderBypasses() {
  // Amp and Cab
  const ampBtn = document.getElementById('bypass-amp');
  if (ampBtn) {
    const on = !!state.blocks.amp;
    ampBtn.classList.toggle('active', on);
    ampBtn.querySelector('.btn-text').textContent = on ? 'AMP ENGAGED' : 'AMP BYPASSED';
  }

  const cabBtn = document.getElementById('bypass-cab');
  if (cabBtn) {
    const on = !!state.blocks.cab;
    cabBtn.classList.toggle('active', on);
    cabBtn.querySelector('.btn-text').textContent = on ? 'CAB ENGAGED' : 'CAB BYPASSED';
  }

  // FX Modules
  const blocks = ['dist', 'mod', 'delay', 'reverb', 'fx1', 'fx2', 'fxloop'];
  blocks.forEach(b => {
    const btn = document.getElementById(`bypass-${b}`);
    if (btn) {
      const on = !!state.blocks[b];
      btn.classList.toggle('active', on);
      btn.querySelector('.btn-text').textContent = on ? 'ON' : 'OFF';
    }
  });

  // Wah
  const wahCard = document.getElementById('card-wah');
  const wahLed = document.getElementById('wah-toe-led');
  if (wahCard && wahLed) {
    const on = !!state.blocks.wah;
    wahCard.classList.toggle('wah-on', on);
    wahLed.classList.toggle('on', on);
  }
}

function renderRigBar() {
  const letter = state.bankType === 'USER'
    ? String.fromCharCode(65 + state.bankIndex)
    : String.fromCharCode(97 + state.bankIndex);
  const pcNum = state.bankIndex * 4 + state.slotIndex;
  const slotCode = `${letter}${state.slotIndex + 1}`;

  document.getElementById('btn-bank-toggle').textContent = state.bankType;
  document.getElementById('rig-slot-display').textContent = slotCode;
  document.getElementById('rig-pc-display').textContent = `Program Change #${String(pcNum).padStart(3, '0')}`;

  const nameKey = `${state.bankType}_${pcNum}`;
  const customName = state.customRigNames[nameKey] || `RIG ${slotCode}`;
  const input = document.getElementById('rig-name-input');
  if (document.activeElement !== input) {
    input.value = customName;
  }

  // 4 Footswitches
  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`stomp-${i}`);
    const code = `${letter}${i + 1}`;
    const p = state.bankIndex * 4 + i;
    const name = state.customRigNames[`${state.bankType}_${p}`] || `RIG ${code}`;
    btn.classList.toggle('active', i === state.slotIndex);
    document.getElementById(`stomp-code-${i}`).textContent = code;
    document.getElementById(`stomp-label-${i}`).textContent = name;
  }
}

function renderPedals() {
  // Wah
  const wahVal = state.params.wah_pedal ?? 0;
  const wahPct = Math.round((wahVal / 127) * 100);
  document.getElementById('readout-wah').textContent = `${wahPct}%`;
  document.getElementById('card-wah').style.setProperty('--pedal-pct', `${wahPct}%`);

  // Volume
  const volVal = state.params.rig_volume ?? 102;
  const volPct = Math.round((volVal / 127) * 100);
  document.getElementById('readout-vol').textContent = `${volPct}%`;
  document.getElementById('card-vol').style.setProperty('--pedal-pct', `${volPct}%`);

  // Multi-FX Exp
  const expVal = state.params.exp_pedal ?? 64;
  const expPct = Math.round((expVal / 127) * 100);
  document.getElementById('readout-exp').textContent = `${expPct}%`;
  document.getElementById('card-exp').style.setProperty('--pedal-pct', `${expPct}%`);
}

function renderTuner() {
  const tunerBtn = document.getElementById('btn-tuner');
  if (tunerBtn) {
    tunerBtn.classList.toggle('active', state.tunerActive);
  }
}

// ============================================================================
// 5. INTERACTIVE DRAG & INPUT HANDLERS
// ============================================================================
function setupKnobDrag(knobEl, paramKey) {
  let startY = 0;
  let startVal = 0;

  const updateParam = (newVal) => {
    if (state.params[paramKey] !== newVal) {
      state.params[paramKey] = newVal;
      updateKnobDOM(paramKey, newVal);

      const cc = CC_MAP[paramKey];
      if (cc !== undefined) {
        sendMidiCC(cc, newVal, paramKey);
      }

      if (paramKey === 'rig_volume') {
        renderPedals();
      }
      saveLocalState();
    }
  };

  const onMove = (e) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY;
    const newVal = Math.max(0, Math.min(127, Math.round(startVal + deltaY * 0.85)));
    updateParam(newVal);
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  };

  const onDown = (e) => {
    e.preventDefault();
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startVal = state.params[paramKey] ?? 64;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  knobEl.addEventListener('mousedown', onDown);
  knobEl.addEventListener('touchstart', onDown, { passive: false });

  knobEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 3 : -3;
    const newVal = Math.max(0, Math.min(127, (state.params[paramKey] ?? 64) + step));
    updateParam(newVal);
  });

  knobEl.addEventListener('dblclick', () => {
    updateParam(64);
  });
}

function setupPedalDrag(treadleEl, paramKey, ccNumber, label) {
  let startY = 0;
  let startVal = 0;

  const updateVal = (newVal) => {
    if (state.params[paramKey] !== newVal) {
      state.params[paramKey] = newVal;
      renderPedals();
      sendMidiCC(ccNumber, newVal, label);
      if (paramKey === 'rig_volume') {
        updateKnobDOM('rig_volume', newVal);
      }
      saveLocalState();
    }
  };

  const onMove = (e) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // Dragging UP increases value (startY - clientY > 0), dragging DOWN decreases value
    const deltaY = startY - clientY;
    const newVal = Math.max(0, Math.min(127, Math.round(startVal + deltaY * 1.5)));
    updateVal(newVal);
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  };

  const onDown = (e) => {
    e.preventDefault();
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startVal = state.params[paramKey] ?? 0;

    // Optional direct click-jump based on vertical position in the treadle box
    const rect = treadleEl.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (rect.bottom - startY) / rect.height));
    const clickVal = Math.round(clickRatio * 127);
    updateVal(clickVal);
    startVal = clickVal;

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  treadleEl.addEventListener('mousedown', onDown);
  treadleEl.addEventListener('touchstart', onDown, { passive: false });

  treadleEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 4 : -4;
    const newVal = Math.max(0, Math.min(127, (state.params[paramKey] ?? 0) + step));
    updateVal(newVal);
  });
}

function selectRigSlot(slotIdx) {
  state.slotIndex = slotIdx;
  const pc = state.bankIndex * 4 + state.slotIndex;
  sendMidiPC(pc, state.bankType);
  renderRigBar();
}

function stepBank(delta) {
  let newBank = state.bankIndex + delta;
  if (newBank < 0) newBank = 25;
  if (newBank > 25) newBank = 0;
  state.bankIndex = newBank;
  const pc = state.bankIndex * 4 + state.slotIndex;
  sendMidiPC(pc, state.bankType);
  renderRigBar();
}

function toggleBypass(block) {
  state.blocks[block] = !state.blocks[block];
  const isOn = state.blocks[block];
  const bypassCCMap = {
    amp: CC_MAP.bypass_amp,
    cab: CC_MAP.bypass_cab,
    dist: CC_MAP.bypass_dist,
    mod: CC_MAP.bypass_mod,
    delay: CC_MAP.bypass_delay,
    reverb: CC_MAP.bypass_reverb,
    fx1: CC_MAP.bypass_fx1,
    fx2: CC_MAP.bypass_fx2,
    fxloop: CC_MAP.bypass_fxloop,
    wah: CC_MAP.bypass_wah
  };

  const cc = bypassCCMap[block];
  if (cc !== undefined) {
    sendMidiCC(cc, isOn ? 127 : 0, `${block.toUpperCase()} ${isOn ? 'ON' : 'OFF'}`);
  }

  renderBypasses();
  saveLocalState();
}

function pushAllKnobs() {
  logMidi('info', 'Pushing all visible live knobs to Eleven Rack...');
  for (const [key, val] of Object.entries(state.params)) {
    const cc = CC_MAP[key];
    if (cc !== undefined && cc !== CC_MAP.rig_input_guitar) {
      sendMidiCC(cc, val, key);
    }
  }
  // Ensure guitar input
  sendMidiCC(CC_MAP.rig_input_guitar, 0, 'Guitar Input Lock');
}

function resetIO() {
  sendMidiCC(CC_MAP.rig_input_guitar, 0, 'Force Guitar True-Z Input');
  sendMidiCC(CC_MAP.wah_pedal, 0, 'Reset Wah Sweep');
  sendMidiCC(CC_MAP.bypass_wah, 0, 'Wah Bypass');
  state.blocks.wah = false;
  state.params.wah_pedal = 0;
  renderBypasses();
  renderPedals();
  logMidi('info', 'Reset I/O: Locked to Guitar (True-Z) input & bypassed Wah.');
}

// ============================================================================
// 6. PERSISTENCE & INITIALIZATION
// ============================================================================
function saveLocalState() {
  try {
    localStorage.setItem('11r_live_theme', state.theme);
    localStorage.setItem('11r_live_rignames', JSON.stringify(state.customRigNames));
    localStorage.setItem('11r_live_params', JSON.stringify(state.params));
    localStorage.setItem('11r_live_blocks', JSON.stringify(state.blocks));
  } catch (_) {}
}

function loadLocalState() {
  try {
    const savedTheme = localStorage.getItem('11r_live_theme');
    if (savedTheme) {
      state.theme = savedTheme;
      document.body.setAttribute('data-theme', state.theme);
      document.getElementById('theme-select').value = state.theme;
    }

    const savedNames = localStorage.getItem('11r_live_rignames');
    if (savedNames) state.customRigNames = JSON.parse(savedNames);

    const savedParams = localStorage.getItem('11r_live_params');
    if (savedParams) state.params = { ...state.params, ...JSON.parse(savedParams) };

    const savedBlocks = localStorage.getItem('11r_live_blocks');
    if (savedBlocks) state.blocks = { ...state.blocks, ...JSON.parse(savedBlocks) };
  } catch (_) {}
}

window.addEventListener('DOMContentLoaded', () => {
  loadLocalState();

  // Setup all knobs drag
  document.querySelectorAll('.knob-body, .sm-knob-body').forEach(knob => {
    const cell = knob.closest('[data-param]');
    if (cell) {
      const paramKey = cell.getAttribute('data-param');
      setupKnobDrag(knob, paramKey);
    }
  });

  // Setup Bypass Buttons
  document.querySelectorAll('[data-block]').forEach(btn => {
    btn.addEventListener('click', () => {
      const block = btn.getAttribute('data-block');
      toggleBypass(block);
    });
  });

  // Wah Pedal Engage Button
  document.getElementById('btn-wah-engage').addEventListener('click', () => {
    toggleBypass('wah');
  });

  // Setup Expression Pedals (Up/Down Drag & Mouse Wheel)
  setupPedalDrag(document.getElementById('treadle-area-wah'), 'wah_pedal', CC_MAP.wah_pedal, 'Wah Sweep');
  setupPedalDrag(document.getElementById('treadle-area-vol'), 'rig_volume', CC_MAP.rig_volume, 'Rig Volume');
  setupPedalDrag(document.getElementById('treadle-area-exp'), 'exp_pedal', CC_MAP.exp_pedal, 'Multi-FX Sweep');

  // Rig Switcher Buttons
  for (let i = 0; i < 4; i++) {
    document.getElementById(`stomp-${i}`).addEventListener('click', () => {
      selectRigSlot(i);
    });
  }

  document.getElementById('btn-bank-prev').addEventListener('click', () => stepBank(-1));
  document.getElementById('btn-bank-next').addEventListener('click', () => stepBank(1));

  document.getElementById('btn-bank-toggle').addEventListener('click', () => {
    state.bankType = state.bankType === 'USER' ? 'FACTORY' : 'USER';
    const pc = state.bankIndex * 4 + state.slotIndex;
    sendMidiPC(pc, state.bankType);
    renderRigBar();
  });

  document.getElementById('rig-name-input').addEventListener('input', (e) => {
    const pc = state.bankIndex * 4 + state.slotIndex;
    const nameKey = `${state.bankType}_${pc}`;
    state.customRigNames[nameKey] = e.target.value.toUpperCase();
    renderRigBar();
    saveLocalState();
  });

  // Tap & Tuner
  document.getElementById('btn-tap-tempo').addEventListener('click', () => {
    sendMidiCC(CC_MAP.tap_tempo, 127, 'Tap Tempo');
    const led = document.getElementById('tap-led');
    led.style.background = 'var(--led-amber)';
    setTimeout(() => led.style.background = '#333', 120);
  });

  document.getElementById('btn-tuner').addEventListener('click', () => {
    state.tunerActive = !state.tunerActive;
    sendMidiCC(CC_MAP.tuner, state.tunerActive ? 127 : 0, `Tuner ${state.tunerActive ? 'ON' : 'OFF'}`);
    renderTuner();
  });

  // Nav actions
  document.getElementById('midi-out-select').addEventListener('change', bindMidiPorts);
  document.getElementById('midi-in-select').addEventListener('change', bindMidiPorts);
  document.getElementById('midi-channel-select').addEventListener('change', (e) => {
    state.midiChannel = parseInt(e.target.value, 10) || 0;
    logMidi('info', `MIDI Channel set to ${state.midiChannel + 1}`);
  });
  document.getElementById('btn-refresh-midi').addEventListener('click', populateMidiDevices);
  document.getElementById('btn-panic-all-off').addEventListener('click', resetIO);
  document.getElementById('btn-sync-all-knobs').addEventListener('click', pushAllKnobs);
  document.getElementById('btn-clear-log').addEventListener('click', () => {
    document.getElementById('midi-log-list').innerHTML = '';
  });

  document.getElementById('theme-select').addEventListener('change', (e) => {
    state.theme = e.target.value;
    document.body.setAttribute('data-theme', state.theme);
    saveLocalState();
  });

  // Render initial board
  renderAllKnobs();
  renderBypasses();
  renderRigBar();
  renderPedals();
  renderTuner();

  // Connect MIDI
  initWebMIDI();
});
