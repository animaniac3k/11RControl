# Avid Eleven Rack — Live Performance Controller

A lightweight, zero-latency Web MIDI controller designed specifically for **live playing** with the **Avid Eleven Rack** connected via USB.

---

## What Changed: The "Less is More" Redesign

Rather than attempting fragile, artificial model-swapping hacks over MIDI (which the hardware does not support cleanly over standard CC), this version focuses 100% on **what the Eleven Rack does reliably and instantaneously in real-time**:

1. **Complete Live Picture in One Screen (Zero Menu Hopping):**
   - **No more switching pages or selecting blocks to reveal knobs.**
   - All primary tone and performance controls are visible and manipulable on a single dashboard at all times:
     - **Live Rig Selector:** User/Factory toggle, Rig slot code (`A1–Z4`), editable Rig name, 4 instant footswitches, Bank `< / >` steppers, Tap Tempo, and Chromatic Tuner.
     - **Hero Amplifier Section:** The 6 classic front-panel amp knobs (`GAIN`, `BASS`, `MID`, `TREBLE`, `PRESENCE`, `MASTER`) plus `AMP OUT`, `RIG VOL`, and `BREAKUP` along with dedicated Amp and Cab bypass switches.
     - **FX Modules:** Dedicated, simultaneous control panels for **Distortion**, **Modulation**, **Delay**, **Reverb**, **FX 1**, **FX 2**, and **FX Loop** with on/off stomp toggles and key parameter knobs.
     - **Performance Pedals:** Live continuous sweeps for **Wah**, **Volume**, and **Multi-FX Expression** with proportional illumination.
     - **Live MIDI Activity Stream:** 2-way real-time monitoring of outgoing (`TX`) and incoming (`RX`) messages.

2. **Rock-Solid Hardware Compliance:**
   - Uses the official **Eleven Rack Table 12 MIDI CC mappings**.
   - **Rig Input Protection:** Prevents the hardware from switching away from Guitar (True-Z) input.
   - **Two-Way Synchronization:** When you turn physical knobs or press buttons on the rack unit, the on-screen controls update automatically over USB MIDI in real-time.

---

## Quick Start

1. Connect your **Avid Eleven Rack** to your Windows PC via USB and power it on.
2. Open [`index.html`](file:///c:/Users/okode/Desktop/DEV/11RControl/index.html) in **Google Chrome** or **Microsoft Edge**.
3. Select **Eleven Rack** in both **MIDI OUT** and **MIDI IN**.
4. Start tweaking! You can drag knobs up/down, use the mouse scroll wheel, or double-click any knob to center it at 5.0 (value 64).
