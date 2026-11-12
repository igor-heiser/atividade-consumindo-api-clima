/*
 * ATMOS® — Interface independente.
 * IMPORTANTE: app.js é o arquivo original da atividade e permanece intacto.
 * Aqui ficam somente a experiência visual e suas interações.
 */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const DEFAULT_CITY = { name: 'Jaraguá do Sul', region: 'Santa Catarina, Brasil', latitude: -26.47858, longitude: -49.09274 };
  const EXPLORATIONS = [
    DEFAULT_CITY,
    { name: 'São Paulo', region: 'São Paulo, Brasil', latitude: -23.5505, longitude: -46.6333 },
    { name: 'Florianópolis', region: 'Santa Catarina, Brasil', latitude: -27.5954, longitude: -48.548 },
    { name: 'Rio de Janeiro', region: 'Rio de Janeiro, Brasil', latitude: -22.9068, longitude: -43.1729 },
  ];
  const KEY_FAVORITES = 'atmos_favorites_v2';
  const KEY_RECENTS = 'atmos_recents_v2';
  const ICONS = {
    sun: '☀', night: '☾', cloudy: '☁', partly: '⛅', rain: '☂', storm: 'ϟ', snow: '❄', fog: '≋', wind: '≋', clear: '✳'
  };
  const codes = {
    0: ['Céu limpo', 'clear', 'sun'], 1: ['Predominantemente limpo', 'clear', 'partly'],
    2: ['Parcialmente nublado', 'cloudy', 'partly'], 3: ['Céu nublado', 'cloudy', 'cloudy'],
    45: ['Neblina', 'fog', 'fog'], 48: ['Neblina com geada', 'fog', 'fog'],
    51: ['Garoa leve', 'rain', 'rain'], 53: ['Garoa moderada', 'rain', 'rain'], 55: ['Garoa intensa', 'rain', 'rain'],
    56: ['Garoa congelante', 'snow', 'snow'], 57: ['Garoa congelante', 'snow', 'snow'],
    61: ['Chuva leve', 'rain', 'rain'], 63: ['Chuva moderada', 'rain', 'rain'], 65: ['Chuva forte', 'rain', 'rain'],
    66: ['Chuva congelante', 'snow', 'snow'], 67: ['Chuva congelante', 'snow', 'snow'],
    71: ['Neve leve', 'snow', 'snow'], 73: ['Neve', 'snow', 'snow'], 75: ['Neve intensa', 'snow', 'snow'], 77: ['Cristais de neve', 'snow', 'snow'],
    80: ['Pancadas leves de chuva', 'rain', 'rain'], 81: ['Pancadas de chuva', 'rain', 'rain'], 82: ['Pancadas fortes de chuva', 'rain', 'rain'],
    85: ['Pancadas de neve', 'snow', 'snow'], 86: ['Neve intensa', 'snow', 'snow'],
    95: ['Trovoadas', 'storm', 'storm'], 96: ['Trovoadas e granizo', 'storm', 'storm'], 99: ['Trovoadas e granizo', 'storm', 'storm']
  };
  const weatherInfo = code => codes[code] || ['Condições variáveis', 'cloudy', 'partly'];
  const state = {
    city: DEFAULT_CITY, data: null, unit: 'C', metric: 'temperature', selectedDay: 0,
    timezone: 'America/Sao_Paulo', weatherController: null, cityController: null,
    searchTimer: null, searchItems: [], activeSearch: -1,
    favorites: fromStorage(KEY_FAVORITES), recents: fromStorage(KEY_RECENTS),
    fx: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    chartData: null, chartIndex: -1, pendingToast: null,
  };

  function fromStorage(key) { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch { return []; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* navegação privada */ } }
  function text(selector, value) { const el = $(selector); if (el) el.textContent = value; }
  function number(value, decimals = 0) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(decimals).replace('.', ',') : '—'; }
  function celsius(temp) { return state.unit === 'C' ? Number(temp) : Number(temp) * 9 / 5 + 32; }
  function tempString(temp) { return Number.isFinite(Number(temp)) ? `${Math.round(celsius(temp))}°` : '—'; }
  function localeTime(iso) { return typeof iso === 'string' ? iso.slice(11, 16) : '--:--'; }
  function dayName(date, options) {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`));
  }
  function direction(degrees) { const parts = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']; return parts[Math.round((Number(degrees) || 0) / 45) % 8]; }
  function inRange(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function sameCity(a, b) { return a && b && Math.abs(Number(a.latitude) - Number(b.latitude)) < .001 && Math.abs(Number(a.longitude) - Number(b.longitude)) < .001; }
  function showToast(message) {
    const host = $('#toast-container'); const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; host.append(el);
    window.setTimeout(() => { el.classList.add('out'); window.setTimeout(() => el.remove(), 280); }, 3900);
  }

  function paintNumber(selector, target) {
    const el = $(selector); if (!el) return;
    if (!Number.isFinite(Number(target))) { el.textContent = '—'; return; }
    const next = Number(target); const previous = Number(el.dataset.current || next);
    el.dataset.current = next;
    const reduced = !state.fx || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || Math.abs(next - previous) > 140) { el.textContent = Math.round(next); return; }
    const stamp = performance.now(); const key = String(stamp); el.dataset.tween = key;
    const step = now => {
      if (el.dataset.tween !== key) return;
      const progress = inRange((now - stamp) / 650, 0, 1); const eased = 1 - (1 - progress) ** 3;
      el.textContent = Math.round(previous + (next - previous) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function summaryFor(current) {
    const [label, kind] = weatherInfo(current.weather_code);
    const temperature = Math.round(Number(current.temperature_2m) || 0);
    const humidity = Math.round(Number(current.relative_humidity_2m) || 0);
    const day = Number(current.is_day) === 1;
    if (kind === 'storm') return 'Trovoadas na região. Evite áreas abertas durante a tempestade.';
    if (kind === 'rain') return 'Chuva em andamento. Vale sair com guarda-chuva.';
    if (kind === 'snow') return 'Precipitação de neve registrada. Atenção ao frio e às vias.';
    if (kind === 'fog') return 'Visibilidade reduzida pela neblina. Dirija com cuidado.';
    if (!day) return `${label} neste momento. Consulte a previsão antes de sair.`;
    if (temperature >= 30) return 'Temperatura elevada. Mantenha-se hidratado e procure sombra.';
    if (temperature <= 14) return 'Temperatura baixa. Um casaco pode ser útil ao sair.';
    if (humidity >= 80) return `Umidade elevada (${humidity}%). Confira a previsão de chuva.`;
    if (kind === 'clear') return 'Céu aberto neste momento. Veja a evolução nas próximas horas.';
    return `${label} na região. Acompanhe a tendência para hoje.`;
  }

  async function requestWeather() {
    state.weatherController?.abort();
    const controller = new AbortController(); state.weatherController = controller;
    const params = new URLSearchParams({
      latitude: String(state.city.latitude), longitude: String(state.city.longitude), timezone: 'auto', forecast_days: '7',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,is_day,cloud_cover,pressure_msl,precipitation,uv_index',
      hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,daylight_duration,uv_index_max'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(result.reason || 'Não foi possível obter a previsão');
    if (!result.current || !result.daily || !result.hourly) throw new Error('Dados meteorológicos incompletos');
    return { result, controller };
  }
  async function loadWeather(manual = false) {
    const button = $('#refresh-button'); button.classList.add('spinning');
    const expectedCity = state.city;
    try {
      const { result, controller } = await requestWeather();
      if (controller !== state.weatherController || expectedCity !== state.city) return;
      state.data = result; state.timezone = result.timezone || 'America/Sao_Paulo';
      state.selectedDay = 0;
      document.body.dataset.weather = weatherInfo(result.current.weather_code)[1];
      document.body.dataset.phase = Number(result.current.is_day) === 1 ? 'day' : 'night';
      renderWeather(); renderChart(); renderWeek(); renderDayDetails(); renderHorizon(); renderInsight(); renderClock();
      updateFavorite();
      if (manual) showToast('O céu acaba de ser atualizado.');
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('ATMOS / Erro ao carregar previsão:', error);
      showToast('Não foi possível consultar o clima. Verifique a conexão e tente novamente.');
      if (!state.data) { text('#hero-condition', 'O céu ficou fora do radar'); text('#hero-description', 'Tente atualizar quando sua conexão estiver disponível.'); text('#weather-story', 'Ainda não conseguimos receber os dados desta cidade.'); }
    } finally { if (expectedCity === state.city) button.classList.remove('spinning'); }
  }

  function renderWeather() {
    if (!state.data) return;
    const { current: c, daily } = state.data;
    const [condition, kind] = weatherInfo(c.weather_code);
    const unit = `°${state.unit}`;
    text('#city-name', state.city.name);
    text('#header-city', state.city.name);
    text('#region-name', state.city.region);
    text('#coord-label', `${Math.abs(state.city.latitude).toFixed(3)}° ${state.city.latitude < 0 ? 'S' : 'N'}  ${Math.abs(state.city.longitude).toFixed(3)}° ${state.city.longitude < 0 ? 'O' : 'L'}`);
    paintNumber('#hero-temp', celsius(c.temperature_2m));
    text('#hero-degree', unit);
    text('#hero-condition', condition);
    text('#hero-description', `Sensação de ${tempString(c.apparent_temperature)} · ${number(c.relative_humidity_2m)}% de umidade`);
    text('#weather-story', summaryFor(c));
    text('#updated-at', `OBSERVADO ÀS ${localeTime(c.time)}`);
    paintNumber('#feels-like', celsius(c.apparent_temperature));
    $$('.temp-unit').forEach(el => { el.textContent = unit; });
    paintNumber('#humidity', c.relative_humidity_2m);
    $('#humidity-meter').style.width = `${inRange(Number(c.relative_humidity_2m) || 0, 0, 100)}%`;
    text('#humidity-caption', c.relative_humidity_2m <= 30 ? 'Ar relativamente seco' : c.relative_humidity_2m >= 75 ? 'Umidade elevada' : 'Umidade moderada');
    paintNumber('#wind-speed', c.wind_speed_10m);
    text('#wind-caption', `Vento vindo de ${direction(c.wind_direction_10m)}`);
    $('#wind-pointer').style.transform = `rotate(${(Number(c.wind_direction_10m) || 0) + 90}deg)`;
    const useCurrentUV = Number.isFinite(c.uv_index);
    const uv = useCurrentUV ? Number(c.uv_index) : Number(daily.uv_index_max?.[0]);
    paintNumber('#uv-index', uv);
    text('#uv-caption', (useCurrentUV ? 'UV atual · ' : 'UV máximo previsto · ') + (uv <= 2 ? 'baixo' : uv <= 5 ? 'moderado' : uv <= 7 ? 'alto' : uv <= 10 ? 'muito alto' : 'extremo'));
    $('#uv-indicator').style.left = `${inRange(uv / 12 * 100, 1, 99)}%`;
    text('#insight-icon', ICONS[kind === 'clear' && Number(c.is_day) === 0 ? 'night' : kind] || ICONS.partly);
    $('#unit-toggle').innerHTML = state.unit === 'C' ? '<span class="unit-active">°C</span><span>°F</span>' : '<span>°C</span><span class="unit-active">°F</span>';
    $('#unit-toggle').setAttribute('aria-label', `Exibindo Fahrenheit e Celsius; unidade atual: ${unit}. Clique para alternar.`);
    if (state.unit === 'C') $('#unit-toggle').setAttribute('aria-label', 'Unidade atual: Celsius. Clique para alternar para Fahrenheit');
  }

  function renderClock() {
    try { text('#local-clock', new Intl.DateTimeFormat('pt-BR', { timeZone: state.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())); }
    catch { text('#local-clock', '--:--:--'); }
  }

  function nextHours() {
    if (!state.data) return [];
    const { hourly, current } = state.data;
    const currentHour = String(current.time).slice(0, 13);
    let start = hourly.time.findIndex(t => String(t).slice(0, 13) >= currentHour);
    if (start === -1) start = 0;
    return hourly.time.slice(start, start + 24).map((time, idx) => ({
      time, temp: Number(hourly.temperature_2m[start + idx]), rain: Number(hourly.precipitation_probability[start + idx]), wind: Number(hourly.wind_speed_10m[start + idx]),
      weather: hourly.weather_code?.[start + idx]
    })).filter(row => Number.isFinite(row.temp));
  }
  function lineD(points) {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1]; const mid = (a.x + b.x) / 2;
      path += ` C ${mid.toFixed(2)} ${a.y.toFixed(2)}, ${mid.toFixed(2)} ${b.y.toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    return path;
  }
  function renderChart() {
    if (!state.data) return;
    const hours = nextHours(); if (!hours.length) return;
    const mode = state.metric;
    const values = hours.map(h => mode === 'temperature' ? celsius(h.temp) : mode === 'rain' ? h.rain : h.wind);
    const minValue = mode === 'rain' ? 0 : Math.floor(Math.min(...values) - 2);
    const maxValue = mode === 'rain' ? 100 : Math.ceil(Math.max(...values) + 2);
    const min = Number.isFinite(minValue) ? minValue : 0; const max = Number.isFinite(maxValue) ? maxValue : 100;
    const x = index => 54 + index / Math.max(1, values.length - 1) * 795;
    const y = value => 222 - (value - min) / Math.max(1, max - min) * 186;
    const points = values.map((value, i) => ({ x: x(i), y: y(value), value, time: hours[i].time }));
    state.chartData = { points, mode, values, min, max }; state.chartIndex = -1;
    const svg = $('#timeline-chart');
    const ns = 'http://www.w3.org/2000/svg';
    const make = (tag, attributes = {}, value = null) => {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, String(v));
      if (value !== null) el.textContent = String(value);
      return el;
    };
    svg.replaceChildren();
    const defs = make('defs'); const grad = make('linearGradient', { id: 'chartGradient', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.append(make('stop', { offset: '0%', 'stop-color': '#4b9872', 'stop-opacity': '.34' }), make('stop', { offset: '100%', 'stop-color': '#4b9872', 'stop-opacity': '0' })); defs.append(grad); svg.append(defs);
    for (let k = 0; k < 4; k++) {
      const val = min + (max - min) * (k / 3); const yy = y(val);
      svg.append(make('line', { x1: 54, y1: yy, x2: 849, y2: yy, class: 'gridline' }), make('text', { x: 39, y: yy + 4, 'text-anchor': 'end', class: 'axis-label' }, Math.round(val)));
    }
    points.forEach((point, i) => { if (i % 4 === 0 || i === points.length - 1) svg.append(make('text', { x: point.x, y: 257, 'text-anchor': 'middle', class: 'axis-label' }, point.time.slice(11, 16))); });
    if (mode === 'rain') {
      points.forEach(point => svg.append(make('rect', { x: point.x - 7, y: y(point.value), width: 14, height: 222 - y(point.value), rx: 3, class: 'chart-bar' })));
    } else {
      const path = lineD(points);
      const area = `${path} L ${points[points.length - 1].x} 222 L ${points[0].x} 222 Z`;
      svg.append(make('path', { d: area, class: 'chart-area-shape' }), make('path', { d: path, class: 'chart-path' }));
    }
    const guide = make('line', { id: 'chart-guide', x1: 0, y1: 31, x2: 0, y2: 222, stroke: '#22815a', 'stroke-dasharray': '4 5', opacity: '0' });
    const circle = make('circle', { id: 'chart-guide-dot', cx: 0, cy: 0, r: 5, fill: '#fff', stroke: '#187a56', 'stroke-width': 3, opacity: '0' });
    svg.append(guide, circle, make('rect', { x: 54, y: 19, width: 795, height: 213, fill: 'transparent', id: 'chart-hit-area', style: 'cursor:crosshair' }));
    $('#chart-wrap').classList.add('is-ready');
    $('#chart-cursor').hidden = true;
    const name = { temperature: 'Temperatura', rain: 'Chance de chuva', wind: 'Velocidade do vento' }[mode];
    const minShown = Math.round(Math.min(...values)); const maxShown = Math.round(Math.max(...values));
    const suffix = mode === 'temperature' ? `°${state.unit}` : mode === 'rain' ? '%' : ' km/h';
    text('#chart-stat', `${name}: ${minShown}${suffix} a ${maxShown}${suffix}`);
  }
  function setChartPointer(index) {
    if (!state.chartData) return;
    const points = state.chartData.points;
    const i = inRange(Math.round(index), 0, points.length - 1);
    if (i === state.chartIndex) return; state.chartIndex = i;
    const point = points[i]; const wrap = $('#chart-wrap'); const chart = $('#timeline-chart');
    const rect = chart.getBoundingClientRect(); const outer = wrap.getBoundingClientRect();
    const px = (point.x / 880) * rect.width + rect.left - outer.left;
    const py = (point.y / 280) * rect.height + rect.top - outer.top;
    const value = Number.isFinite(point.value) ? Math.round(point.value) : '—';
    const suffix = state.metric === 'temperature' ? `°${state.unit}` : state.metric === 'rain' ? '%' : ' km/h';
    text('#chart-tooltip', `${point.time.slice(11, 16)} · ${value}${suffix}`);
    const tip = $('#chart-cursor'); tip.hidden = false; tip.style.left = `${inRange(px, 60, outer.width - 60)}px`; tip.style.top = `${py}px`;
    $('#chart-guide').setAttribute('x1', point.x); $('#chart-guide').setAttribute('x2', point.x); $('#chart-guide').setAttribute('opacity', '1');
    $('#chart-guide-dot').setAttribute('cx', point.x); $('#chart-guide-dot').setAttribute('cy', point.y); $('#chart-guide-dot').setAttribute('opacity', '1');
  }
  function clearChartPointer() {
    state.chartIndex = -1; $('#chart-cursor').hidden = true;
    $('#chart-guide')?.setAttribute('opacity', '0'); $('#chart-guide-dot')?.setAttribute('opacity', '0');
  }
  $('#timeline-chart').addEventListener('pointermove', event => {
    if (!state.chartData) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * 880;
    setChartPointer((px - 54) / 795 * (state.chartData.points.length - 1));
  });
  $('#timeline-chart').addEventListener('pointerleave', clearChartPointer);
  $('#timeline-chart').setAttribute('tabindex', '0');
  $('#timeline-chart').addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault(); setChartPointer(Math.max(0, state.chartIndex) + (event.key === 'ArrowRight' ? 1 : -1));
  });
  $('#timeline-chart').addEventListener('blur', clearChartPointer);

  function renderWeek() {
    if (!state.data) return;
    const day = state.data.daily;
    const list = $('#week-list'); list.replaceChildren();
    for (let i = 0; i < Math.min(7, day.time.length); i++) {
      const [label, kind, icon] = weatherInfo(day.weather_code[i]);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'week-day';
      button.setAttribute('role', 'listitem'); button.setAttribute('aria-pressed', String(i === state.selectedDay));
      button.setAttribute('aria-label', `${i === 0 ? 'Hoje' : dayName(day.time[i], { weekday: 'long' })}: ${label}, máxima ${tempString(day.temperature_2m_max[i])}, mínima ${tempString(day.temperature_2m_min[i])}, chuva ${number(day.precipitation_probability_max[i])}%`);
      const date = document.createElement('div'); date.className = 'weekday';
      const title = document.createElement('span'); title.textContent = i === 0 ? 'Hoje' : dayName(day.time[i], { weekday: 'short' }).replace('.', '');
      const dateNumber = document.createElement('span'); dateNumber.className = 'week-num'; dateNumber.textContent = day.time[i].slice(8, 10);
      date.append(title, dateNumber);
      const weather = document.createElement('div'); weather.className = 'week-icon'; weather.textContent = ICONS[icon] || ICONS[kind] || '☀';
      const temp = document.createElement('div'); temp.className = 'week-temps';
      const high = document.createElement('span'); high.textContent = tempString(day.temperature_2m_max[i]);
      const low = document.createElement('small'); low.textContent = ` ${tempString(day.temperature_2m_min[i])}`; temp.append(high, low);
      const rain = document.createElement('div'); rain.className = 'week-rain'; rain.textContent = `☂  ${number(day.precipitation_probability_max[i])}% CHUVA`;
      button.append(date, weather, temp, rain);
      button.addEventListener('click', () => { state.selectedDay = i; $$('.week-day').forEach((el, pos) => el.setAttribute('aria-pressed', String(pos === i))); renderDayDetails(); });
      list.append(button);
    }
  }
  function renderDayDetails() {
    if (!state.data) return;
    const d = state.data.daily; const i = state.selectedDay;
    const longDay = i === 0 ? 'Hoje' : dayName(d.time[i], { weekday: 'long', day: 'numeric', month: 'long' });
    text('#detail-day', longDay[0].toUpperCase() + longDay.slice(1));
    $('#day-detail').dataset.weather = weatherInfo(d.weather_code[i])[1];
    text('#detail-condition', weatherInfo(d.weather_code[i])[0]);
    text('#detail-temps', `${tempString(d.temperature_2m_max[i])} / ${tempString(d.temperature_2m_min[i])}`);
    text('#detail-rain', `${number(d.precipitation_probability_max[i])}%`);
    text('#detail-wind', `${number(d.wind_speed_10m_max[i])} km/h`);
    text('#detail-sun', `${localeTime(d.sunrise[i])} – ${localeTime(d.sunset[i])}`);
  }
  function renderHorizon() {
    if (!state.data) return;
    const d = state.data.daily;
    const rise = d.sunrise[0]; const set = d.sunset[0];
    text('#sunrise', localeTime(rise)); text('#sunset', localeTime(set));
    const seconds = d.daylight_duration?.[0];
    let mins;
    if (Number.isFinite(seconds)) mins = Math.round(seconds / 60);
    else { const [aH,aM] = localeTime(rise).split(':').map(Number); const [bH,bM] = localeTime(set).split(':').map(Number); mins = (bH - aH) * 60 + bM - aM; }
    text('#daylight-length', `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2,'0')}min`);
    const hourMins = iso => { const [h,m] = localeTime(iso).split(':').map(Number); return h * 60 + m; };
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: state.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const now = hourMins(`YYYY-MM-DDT${localTime}`);
    const p = inRange((now - hourMins(rise)) / (hourMins(set) - hourMins(rise) || 1), 0, 1);
    const arc = $('#horizon-sun');
    arc.style.left = `${7 + 86 * p}%`;
    arc.style.top = `${108 - 91 * Math.sin(p * Math.PI)}px`;
    arc.style.opacity = now < hourMins(rise) || now > hourMins(set) ? '.4' : '1';
  }
  function renderInsight() {
    if (!state.data) return;
    const c = state.data.current;
    const hours = nextHours().slice(0, 12);
    const maxRain = hours.length ? Math.max(...hours.map(h => h.rain)) : 0;
    const firstRain = hours.find(h => h.rain >= 55);
    let title, description;
    if (maxRain >= 55) { title = 'Chuva no radar'; description = `A probabilidade de chuva chega a ${Math.round(maxRain)}% nas próximas 12 horas${firstRain ? `, com destaque por volta das ${localeTime(firstRain.time)}` : ''}.`;
    } else if (Number(c.is_day) === 0) { title = 'Previsão para a noite'; description = `Agora: ${weatherInfo(c.weather_code)[0].toLowerCase()}. Veja a evolução do tempo nas próximas horas.`;
    } else if (Number(c.temperature_2m) >= 30) { title = 'Calor em destaque'; description = `Temperatura atual de ${tempString(c.temperature_2m)}. Prefira sombra e água ao sair.`;
    } else if (maxRain <= 20) { title = 'Pouca chuva prevista'; description = `Chance de chuva de até ${Math.round(maxRain)}% nas próximas 12 horas.`;
    } else { title = 'Tempo variável'; description = `A chance de chuva chega a ${Math.round(maxRain)}% nas próximas 12 horas.`; }
    text('#insight-title', title); text('#insight-text', description);
  }

  function updateFavorite() {
    const on = state.favorites.some(city => sameCity(city, state.city));
    const button = $('#favorite-button'); button.classList.toggle('is-favorite', on); button.textContent = on ? '★' : '☆';
    button.title = on ? 'Remover dos favoritos' : 'Salvar como favorito';
    button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(on));
  }
  function toggleFavorite() {
    const exists = state.favorites.some(city => sameCity(city, state.city));
    if (exists) state.favorites = state.favorites.filter(city => !sameCity(city, state.city));
    else state.favorites.unshift({ ...state.city });
    state.favorites = state.favorites.slice(0, 12); save(KEY_FAVORITES, state.favorites); updateFavorite();
    showToast(exists ? 'Cidade removida dos favoritos.' : 'Cidade salva nos favoritos.');
  }
  async function switchCity(city) {
    state.city = { name: city.name, region: city.region || city.country || '', latitude: Number(city.latitude), longitude: Number(city.longitude) };
    state.data = null; state.timezone = 'America/Sao_Paulo';
    state.recents = [state.city, ...state.recents.filter(c => !sameCity(c, state.city))].slice(0, 6);
    save(KEY_RECENTS, state.recents); closeSearch();
    text('#city-name', state.city.name); text('#header-city', state.city.name); text('#region-name', state.city.region);
    text('#hero-condition', 'Um novo céu a caminho...'); text('#hero-description', 'Sincronizando sua próxima localização.');
    text('#weather-story', 'Cada cidade oferece uma atmosfera diferente.');
    text('#hero-temp', '—'); text('#feels-like', '—'); text('#humidity', '—'); text('#wind-speed', '—'); text('#uv-index', '—');
    $$('.temp-unit').forEach(el => { el.textContent = `°${state.unit}`; });
    ['#hero-temp','#feels-like','#humidity','#wind-speed','#uv-index'].forEach(sel => { const el = $(sel); delete el.dataset.current; });
    $('#week-list').innerHTML = '<div class="loading-line">Buscando os próximos sete dias...</div>';
    $('#chart-wrap').classList.remove('is-ready'); $('#timeline-chart').replaceChildren();
    loadWeather();
  }

  function openSearch() {
    $('#palette-backdrop').hidden = false; $('#command-palette').hidden = false;
    $('#palette-input').value = ''; state.activeSearch = -1;
    showDefaultLocations(); $('#palette-input').focus(); document.body.style.overflow = 'hidden';
  }
  function closeSearch() {
    $('#palette-backdrop').hidden = true; $('#command-palette').hidden = true;
    state.cityController?.abort(); clearTimeout(state.searchTimer); document.body.style.overflow = '';
    $('#open-search').focus({ preventScroll: true });
  }
  function showDefaultLocations() {
    const items = [...state.favorites.map(c => ({ ...c, tag: 'FAVORITO', symbol: '★' })), ...state.recents.map(c => ({ ...c, tag: 'RECENTE', symbol: '↗' })), ...EXPLORATIONS.map(c => ({ ...c, tag: 'EXPLORAR', symbol: '⌖' }))];
    state.searchItems = items.filter((city, i) => items.findIndex(c => sameCity(c, city)) === i).slice(0, 8);
    renderSearchItems();
  }
  function renderSearchItems(message = 'Nenhuma cidade encontrada. Tente outro nome.') {
    const list = $('#palette-list'); list.replaceChildren();
    if (!state.searchItems.length) { const empty = document.createElement('div'); empty.className = 'palette-empty'; empty.textContent = message; list.append(empty); return; }
    state.searchItems.forEach((city, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'palette-item' + (i === state.activeSearch ? ' is-active' : '');
      button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(i === state.activeSearch));
      const main = document.createElement('span'); main.className = 'item-main';
      const symbol = document.createElement('span'); symbol.className = 'item-icon'; symbol.textContent = city.symbol || '⌖';
      const names = document.createElement('span'); const title = document.createElement('strong'); title.textContent = city.name;
      const subtitle = document.createElement('small'); subtitle.textContent = `${city.region || ''}${city.tag ? ' · ' + city.tag : ''}`;
      names.append(title, subtitle); main.append(symbol, names);
      const arrow = document.createElement('span'); arrow.textContent = '↗'; button.append(main, arrow);
      button.addEventListener('click', () => switchCity(city)); list.append(button);
    });
  }
  async function searchCities(term) {
    state.cityController?.abort();
    const controller = new AbortController(); state.cityController = controller;
    state.searchItems = []; renderSearchItems('Buscando cidades pelo mundo...');
    try {
      const params = new URLSearchParams({ name: term, count: '8', language: 'pt', format: 'json' });
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Resposta ${response.status}`);
      const result = await response.json(); if (controller !== state.cityController) return;
      state.searchItems = (result.results || []).map(place => ({
        name: place.name, region: [place.admin1, place.country].filter(Boolean).join(', '), latitude: place.latitude, longitude: place.longitude, symbol: '⌖'
      }));
      state.activeSearch = -1; renderSearchItems();
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('ATMOS / Geocoding:', error); state.searchItems = []; renderSearchItems('Não foi possível buscar cidades. Verifique sua conexão.');
    }
  }
  $('#palette-input').addEventListener('input', event => {
    clearTimeout(state.searchTimer);
    const term = event.target.value.trim();
    if (term.length < 2) { state.cityController?.abort(); showDefaultLocations(); return; }
    state.searchTimer = setTimeout(() => searchCities(term), 290);
  });
  $('#palette-input').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!state.searchItems.length) return; event.preventDefault();
      state.activeSearch = (state.activeSearch + (event.key === 'ArrowDown' ? 1 : -1) + state.searchItems.length) % state.searchItems.length;
      $$('.palette-item').forEach((el, i) => { el.classList.toggle('is-active', i === state.activeSearch); el.setAttribute('aria-selected', String(i === state.activeSearch)); });
      $$('.palette-item')[state.activeSearch]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault(); const city = state.searchItems[state.activeSearch < 0 ? 0 : state.activeSearch]; if (city) switchCity(city);
    }
  });
  document.addEventListener('keydown', event => {
    const paletteOpen = !$('#command-palette').hidden;
    if (event.key === 'Escape' && paletteOpen) { event.preventDefault(); closeSearch(); return; }
    if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && !paletteOpen)) { event.preventDefault(); if (!paletteOpen) openSearch(); else closeSearch(); }
    if (event.key === 'Tab' && paletteOpen) {
      const focusables = $$('#command-palette button:not([disabled]), #command-palette input');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  $('#open-search').addEventListener('click', openSearch);
  $('#palette-close').addEventListener('click', closeSearch);
  $('#palette-backdrop').addEventListener('click', closeSearch);
  $('#favorite-button').addEventListener('click', toggleFavorite);
  $('#refresh-button').addEventListener('click', () => loadWeather(true));
  $('#unit-toggle').addEventListener('click', () => {
    state.unit = state.unit === 'C' ? 'F' : 'C';
    if (state.data) { renderWeather(); renderChart(); renderWeek(); renderDayDetails(); }
    else $('#unit-toggle').innerHTML = state.unit === 'C' ? '<span class="unit-active">°C</span><span>°F</span>' : '<span>°C</span><span class="unit-active">°F</span>';
  });
  $$('.chart-option').forEach(button => button.addEventListener('click', () => {
    state.metric = button.dataset.metric;
    $$('.chart-option').forEach(el => { const active = el === button; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
    if (state.data) renderChart();
  }));

  $('#fx-button').addEventListener('click', () => {
    state.fx = !state.fx; document.body.classList.toggle('fx-off', !state.fx);
    $('#fx-button').setAttribute('aria-pressed', String(state.fx));
    $('#fx-button').setAttribute('aria-label', state.fx ? 'Pausar animações ambientes' : 'Reativar animações ambientes');
    $('#fx-button').title = state.fx ? 'Pausar animações' : 'Reativar animações';
    $('#fx-button').innerHTML = state.fx ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 5v14M16 5v14"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 5 12 7-12 7V5Z"/></svg>';
    if (state.fx) animateParticles(); else cancelAnimationFrame(particleFrame);
  });
  $('#share-button').addEventListener('click', async () => {
    const current = state.data?.current;
    if (!current) { showToast('O clima ainda está sendo carregado.'); return; }
    const content = `ATMOS® — ${state.city.name}: ${tempString(current.temperature_2m)} e ${weatherInfo(current.weather_code)[0].toLowerCase()}. Explore em ${location.href.split('#')[0]}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Meu céu agora — ATMOS®', text: content });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); showToast('Resumo do clima copiado para compartilhar.'); }
      else { window.prompt('Copie o resumo do clima:', content); }
    } catch (error) { if (error.name !== 'AbortError') showToast('Não foi possível compartilhar neste navegador.'); }
  });

  // Animações com IntersectionObserver; respeita a preferência do navegador por movimento reduzido.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } });
    }, { rootMargin: '0px 0px 55px 0px', threshold: .09 });
    $$('.reveal').forEach(el => observer.observe(el));
  } else $$('.reveal').forEach(el => el.classList.add('in-view'));

  const stage = $('#weather-stage');
  stage.addEventListener('pointermove', event => {
    if (!state.fx || event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty('--stage-x', `${((event.clientX - rect.left) / rect.width - .5) * 34}px`);
    stage.style.setProperty('--stage-y', `${((event.clientY - rect.top) / rect.height - .5) * 24}px`);
  });
  stage.addEventListener('pointerleave', () => { stage.style.setProperty('--stage-x', '0px'); stage.style.setProperty('--stage-y', '0px'); });
  document.addEventListener('pointermove', event => {
    if (!state.fx) return;
    $('#cursor-light').style.setProperty('--cursor-x', `${event.clientX}px`);
    $('#cursor-light').style.setProperty('--cursor-y', `${event.clientY}px`);
  }, { passive: true });
  // Efeito Tilt sutil, limitado aos desktops com mouse.
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.tilt').forEach(card => {
      card.addEventListener('pointermove', event => {
        if (!state.fx) return;
        const rect = card.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width - .5) * 8; const y = ((event.clientY - rect.top) / rect.height - .5) * 8;
        card.style.transform = `perspective(650px) rotateX(${-y}deg) rotateY(${x}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // Chuva / neve / faíscas ambientes: canvas não bloqueia cliques.
  const canvas = $('#weather-canvas'); const ctx = canvas.getContext('2d', { alpha: true });
  let particles = [], particleFrame = 0, lastParticleAt = 0, sceneWidth = 0, sceneHeight = 0;
  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
    sceneWidth = window.innerWidth; sceneHeight = window.innerHeight;
    canvas.width = Math.round(sceneWidth * pixelRatio); canvas.height = Math.round(sceneHeight * pixelRatio);
    canvas.style.width = `${sceneWidth}px`; canvas.style.height = `${sceneHeight}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    particles = Array.from({ length: Math.min(125, Math.floor(sceneWidth / 9)) }, () => spawnParticle(true));
  }
  function spawnParticle(randomY = false) {
    const kind = document.body.dataset.weather;
    const speed = kind === 'rain' || kind === 'storm' ? 5 + Math.random() * 6 : .2 + Math.random() * .8;
    return { x: Math.random() * sceneWidth, y: randomY ? Math.random() * sceneHeight : -30, size: Math.random() * 1.5 + .5, speed, opacity: .14 + Math.random() * .35, drift: (Math.random() - .5) * 1.3 };
  }
  function animateParticles(timestamp = 0) {
    if (!state.fx || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (timestamp - lastParticleAt < 28) { particleFrame = requestAnimationFrame(animateParticles); return; }
    lastParticleAt = timestamp; ctx.clearRect(0, 0, sceneWidth, sceneHeight);
    const kind = document.body.dataset.weather;
    const falling = ['rain','storm','snow'].includes(kind);
    particles.forEach((p, i) => {
      ctx.beginPath(); ctx.globalAlpha = falling ? p.opacity * .7 : p.opacity * .6;
      if (kind === 'rain' || kind === 'storm') {
        ctx.strokeStyle = '#a1cff6'; ctx.lineWidth = p.size * .7; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 5, p.y + 17); ctx.stroke();
        p.x -= 1.2; p.y += p.speed;
      } else {
        ctx.fillStyle = kind === 'snow' ? '#e8f4ff' : '#e2c4aa'; ctx.arc(p.x, p.y, p.size * (kind === 'snow' ? 2 : .85), 0, Math.PI * 2); ctx.fill();
        p.x += p.drift; p.y += kind === 'snow' ? p.speed * 1.5 : p.speed * .4;
      }
      if (p.y > sceneHeight + 30 || p.x < -30 || p.x > sceneWidth + 30) particles[i] = spawnParticle();
    });
    ctx.globalAlpha = 1; particleFrame = requestAnimationFrame(animateParticles);
  }
  window.addEventListener('resize', resizeCanvas, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.fx) { cancelAnimationFrame(particleFrame); particleFrame = requestAnimationFrame(animateParticles); } });
  resizeCanvas();
  if (!state.fx) document.body.classList.add('fx-off');
  else particleFrame = requestAnimationFrame(animateParticles);
  $('#fx-button').setAttribute('aria-pressed', String(state.fx));
  if (!state.fx) { $('#fx-button').setAttribute('aria-label', 'Reativar animações ambientes'); $('#fx-button').title = 'Reativar animações'; $('#fx-button').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 5 12 7-12 7V5Z"/></svg>'; }

  // Scroll editorial: progresso, parallax discreto e mudança de seção ativa.
  const progressBar = $('#scroll-progress');
  const hero = $('#weather-stage');
  const forecast = $('#previsao');
  let scrollPending = false;
  function updateScrollScene() {
    scrollPending = false;
    const y = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.transform = `scaleX(${inRange(y / maxScroll, 0, 1)})`;
    const rect = hero.getBoundingClientRect();
    const p = inRange((window.innerHeight * .2 - rect.top) / Math.max(1, rect.height), 0, 1);
    hero.style.setProperty('--scroll-p', String(p));
    hero.style.setProperty('--hero-shift', `${p * 64}px`);
    hero.style.setProperty('--scene-shift', `${p * 28}px`);
    hero.style.setProperty('--content-shift', `${p * 17}px`);
    hero.style.setProperty('--stage-progress', `${p * 100}%`);
    hero.classList.toggle('is-passing', p > .12);
    const forecastActive = forecast.getBoundingClientRect().top <= window.innerHeight * .45;
    $$('.nav-link').forEach(link => link.classList.toggle('is-current', link.dataset.sectionLink === (forecastActive ? 'previsao' : 'inicio')));
    document.querySelector('.site-header').classList.toggle('header-in-forecast', forecastActive);
  }
  window.addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(updateScrollScene);
  }, { passive: true });
  window.addEventListener('resize', updateScrollScene, { passive: true });
  updateScrollScene();

  text('#year', new Date().getFullYear());
  renderClock(); setInterval(renderClock, 1000);
  // Atualiza a posição solar a cada minuto, sem consumir novamente a API.
  setInterval(() => { if (state.data) renderHorizon(); }, 60_000);
  updateFavorite();
  loadWeather();
})();
