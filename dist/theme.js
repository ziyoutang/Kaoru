(() => {
  const root = document.documentElement;
  const key = 'kaoru-light-mode';
  let dark = false;
  let audio;
  try { dark = localStorage.getItem(key) === 'dark'; } catch {}
  root.dataset.theme = dark ? 'dark' : 'light';

  function switchSound() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      void audio.resume().catch(() => {});
      const now = audio.currentTime;
      const buffer = audio.createBuffer(1, audio.sampleRate * .035, audio.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * .006));
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = dark ? 1500 : 2300;
      gain.gain.value = .15;
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start(now);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('#light-switch');
    const sync = () => {
      root.dataset.theme = dark ? 'dark' : 'light';
      toggle.setAttribute('aria-checked', String(!dark));
      toggle.title = dark ? 'Turn the light on' : 'Turn the light off';
      document.querySelector('meta[name="theme-color"]').content = dark ? '#191f30' : '#ffffff';
    };
    sync();
    toggle.addEventListener('click', () => {
      dark = !dark;
      sync();
      try { localStorage.setItem(key, dark ? 'dark' : 'light'); } catch {}
      switchSound();
    });
  });
})();
