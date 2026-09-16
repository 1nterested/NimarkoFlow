"use strict";
"require view";
"require rpc";
"require poll";
"require ui";

const api = {};
['status', 'connect', 'disconnect', 'refresh', 'remove'].forEach(function(method) {
  api[method] = rpc.declare({ object: 'nimarkoflow', method: method, expect: {} });
});
api.import = rpc.declare({ object: 'nimarkoflow', method: 'import', params: ['source', 'user_agent', 'mode'], expect: {} });

function icon(name) {
  const paths = {
    flow: 'M4 17V7l8 10V7M16 7h4M16 12h3M16 17h4',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    power: 'M12 3v9M7 5a9 9 0 1 0 10 0',
    refresh: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3',
    help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[name] || paths.flow);
  svg.appendChild(p);
  return svg;
}
function el(tag, cls, content) { return E(tag, { class: cls }, content); }
function button(text, cls, click, glyph) {
  return E('button', { type: 'button', class: cls, click: click }, [glyph ? icon(glyph) : '', el('span', '', text)]);
}
function note(text) { return el('p', 'nf-muted', text); }

return view.extend({
  handleSave: null,
  handleSaveApply: null,
  handleReset: null,
  load: function() { return api.status().catch(function() { return { available: false }; }); },
  render: function(initial) {
    let state = initial || {};
    let pending = false;
    const root = el('div', 'cbi-map nf-app');
    const feedback = E('div', { class: 'nf-feedback', role: 'status', 'aria-live': 'polite' });
    const statusPill = el('span', 'nf-status');
    const headline = el('h2', 'nf-hero-title');
    const detail = el('p', 'nf-hero-detail');
    const connection = el('strong', 'nf-card-value');
    const profile = el('strong', 'nf-card-value');
    const hwid = el('strong', 'nf-card-value');
    const actions = [];
    function message(text, error) { feedback.textContent = text; feedback.className = 'nf-feedback' + (error ? ' nf-feedback--error' : ''); }
    function update(value) {
      state = value || { available: false };
      root.classList.toggle('nf-app--connected', !!state.running);
      statusPill.textContent = !state.available ? 'Нет связи с сервисом' : state.busy ? 'Применяем настройки' : state.running ? 'Подключено' : 'Отключено';
      statusPill.className = 'nf-status' + (state.running ? ' nf-status--on' : '');
      headline.textContent = state.running ? 'Ваш поток.\nВаши правила.' : state.configured ? 'Подключение\nпод вашим контролем.' : 'Свобода начинается\nс подключения.';
      detail.textContent = state.running ? 'Маршрутизация активна. Управляйте подключением в одном месте.' : state.configured ? 'Профиль сохранён. Включите подключение, когда оно понадобится.' : 'Добавьте подписку — NimarkoFlow настроит подключение на вашем роутере.';
      connection.textContent = state.running ? 'Активно' : 'Не активно';
      profile.textContent = state.configured ? (state.source === 'subscription' ? 'Подписка' : 'Локальный профиль') : 'Не добавлен';
      hwid.textContent = state.configured && state.hwid ? 'Включён' : 'Не используется';
      connect.querySelector('span').textContent = state.running ? 'Отключить' : 'Подключить';
      actions.forEach(function(b) { b.disabled = pending || !!state.busy || !state.available; });
      connect.disabled = connect.disabled || !state.configured;
      refresh.disabled = refresh.disabled || !state.configured || state.source !== 'subscription';
      remove.disabled = remove.disabled || !state.configured;
    }
    async function run(method) {
      pending = true; update(state); message('Выполняем…');
      try {
        const result = await api[method]();
        if (!result.ok) throw new Error('action');
        message('Запрос принят. Статус обновится автоматически.');
        update(await api.status());
      } catch (e) { message('Не удалось выполнить действие. Попробуйте позже.', true); }
      pending = false; update(state);
    }
    const connect = button('Подключить', 'nf-button nf-button--primary', function() { run(state.running ? 'disconnect' : 'connect'); }, 'power');
    const refresh = button('Обновить подписку', 'nf-button nf-button--secondary', function() { run('refresh'); }, 'refresh');
    const remove = button('Удалить профиль', 'nf-button nf-button--quiet', function() {
      ui.showModal('Удалить профиль?', [note('Сохранённая подписка и параметры подключения будут удалены. Соединение остановится.'), el('div', 'nf-modal-actions', [button('Отмена', 'nf-button nf-button--secondary', ui.hideModal), button('Удалить', 'nf-button nf-button--primary', function() { ui.hideModal(); run('remove'); })])]);
    });
    actions.push(connect, refresh, remove);

    const overview = el('section', 'nf-panel', [
      el('div', 'nf-section-heading', [el('div', '', [el('p', 'nf-eyebrow', 'ОБЗОР СЕТИ'), el('h1', '', 'Всё начинается с Flow')]), statusPill]),
      el('div', 'nf-hero', [
        el('div', 'nf-hero-copy', [el('span', 'nf-eyebrow nf-eyebrow--mint', 'NIMARKOFLOW / OPENWRT'), headline, detail, el('div', 'nf-actions', [connect, button('Добавить подписку', 'nf-button nf-button--secondary', function() { selectTab(1); }, 'arrow')])]),
        E('div', { class: 'nf-orbit', 'aria-hidden': 'true' }, [el('div', 'nf-orbit-ring nf-orbit-ring--one'), el('div', 'nf-orbit-ring nf-orbit-ring--two'), el('div', 'nf-orbit-ring nf-orbit-ring--three'), el('div', 'nf-orbit-core', icon('flow')), el('span', 'nf-orbit-dot nf-orbit-dot--one'), el('span', 'nf-orbit-dot nf-orbit-dot--two'), el('span', 'nf-orbit-label', 'LET IT FLOW')])
      ]),
      el('div', 'nf-cards', [
        el('article', 'nf-card', [el('div', 'nf-card-label', [icon('power'), 'Соединение']), connection, note('Состояние службы на роутере')]),
        el('article', 'nf-card', [el('div', 'nf-card-label', [icon('link'), 'Профиль']), profile, note('Параметры остаются на устройстве')]),
        el('article', 'nf-card', [el('div', 'nf-card-label', [icon('shield'), 'Идентификатор устройства']), hwid, note('HWID передаётся провайдеру подписки')])
      ]),
      el('div', 'nf-bottom-card', [el('div', '', [el('h3', '', 'Подписка под контролем'), note('Автоматическое обновление каждый час. Ссылки и ключи не возвращаются в панель.')]), refresh])
    ]);
    const sourceType = E('select', { id: 'nf-source-type' }, [E('option', { value: 'subscription' }, 'Подписка HTTPS'), E('option', { value: 'links' }, 'Ссылки подключения')]);
    const urlInput = E('input', { id: 'nf-source-url', type: 'password', placeholder: 'https://…', autocomplete: 'off', spellcheck: 'false' });
    const linksInput = E('textarea', { id: 'nf-source-links', rows: '5', 'aria-label': 'Ссылки подключения', placeholder: 'Одна ссылка на строку', autocomplete: 'off', spellcheck: 'false', class: 'nf-secret' });
    linksInput.hidden = true;
    const ua = E('input', { id: 'nf-user-agent', type: 'text', value: 'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0', placeholder: 'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0', autocomplete: 'off', maxlength: '128' });
    const mode = E('select', { id: 'nf-route-mode' }, [E('option', { value: 'full' }, 'Весь трафик'), E('option', { value: 'selective' }, 'Выбранные сервисы (список russia_inside)')]);
    const reveal = E('input', { type: 'checkbox', id: 'nf-reveal', change: function() { urlInput.type = this.checked ? 'text' : 'password'; linksInput.classList.toggle('nf-secret', !this.checked); } });
    sourceType.addEventListener('change', function() { urlInput.hidden = this.value !== 'subscription'; linksInput.hidden = this.value !== 'links'; ua.disabled = this.value !== 'subscription'; });
    const submit = button('Сохранить и подключить', 'nf-button nf-button--primary', async function() {
      const source = sourceType.value === 'subscription' ? urlInput.value.trim() : linksInput.value.trim();
      if (!source) { message('Введите подписку или ссылки подключения.', true); (sourceType.value === 'subscription' ? urlInput : linksInput).focus(); return; }
      pending = true; update(state); message('Сохраняем профиль…');
      try {
        const result = await api.import(source, ua.value.trim(), mode.value);
        if (!result.ok) { message(result.error === 'invalid' ? 'Проверьте формат подписки или ссылок. Подписка должна использовать HTTPS.' : 'Не удалось сохранить профиль. Повторите позже.', true); }
        else {
          urlInput.value = ''; linksInput.value = ''; ua.value = 'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0'; reveal.checked = false; urlInput.type = 'password'; linksInput.classList.add('nf-secret');
          message(result.started ? 'Профиль сохранён. Подключаем…' : 'Профиль сохранён, но запуск не выполнен. Нажмите «Подключить».', !result.started);
          update(await api.status()); selectTab(0);
        }
      } catch (e) { message('Не удалось связаться с сервисом. Повторите позже.', true); }
      pending = false; update(state);
    }, 'arrow');
    actions.push(submit);
    function field(title, id, control, help) { return el('div', 'nf-field', [E('label', { for: id }, title), control, help ? note(help) : '']); }
    const subscription = el('section', 'nf-panel', [
      el('div', 'nf-section-heading', [el('div', '', [el('p', 'nf-eyebrow', 'ВАШ ПРОФИЛЬ'), el('h1', '', 'Один шаг до подключения')])]),
      el('div', 'nf-import-layout', [
        el('div', 'nf-form-card', [el('h2', '', 'Добавить подключение'), note('Новая подписка заменит текущий профиль. Сохранённые параметры не отображаются.'), field('Источник', 'nf-source-type', sourceType), el('div', 'nf-field', [E('label', { for: 'nf-source-url', id: 'nf-source-label' }, 'Подписка или ссылки'), urlInput, linksInput, E('label', { class: 'nf-check', for: 'nf-reveal' }, [reveal, 'Показать введённый текст'])]), field('Маршрутизация', 'nf-route-mode', mode), field('User-Agent провайдера', 'nf-user-agent', ua, 'Заполните только если провайдер требует конкретный клиент. HWID передаётся автоматически.'), submit, remove]),
        el('aside', 'nf-aside-card', [icon('shield'), el('h2', '', 'На вашем устройстве'), note('Подписка обрабатывается на роутере. Панель получает только состояние подключения.'), el('ol', 'nf-steps', [el('li', '', 'Вставьте ссылку от провайдера'), el('li', '', 'Выберите режим маршрутизации'), el('li', '', 'Сохраните и дождитесь подключения')]), note('HWID ограничивает получение подписки согласно правилам провайдера. Администратор роутера имеет доступ к локальным данным.')])
      ])
    ]);
    const help = el('section', 'nf-panel', [el('div', 'nf-section-heading', [el('div', '', [el('p', 'nf-eyebrow', 'ПОМОЩЬ'), el('h1', '', 'Просто о подключении')])]), el('div', 'nf-help-grid', [
      el('article', 'nf-form-card', [el('h2', '', 'Что делает HWID?'), note('Роутер отправляет идентификатор устройства в запросе подписки. Провайдер решает, разрешено ли этому устройству получить конфигурации. Для уже привязанной подписки может потребоваться сброс устройства у провайдера.')]),
      el('article', 'nf-form-card', [el('h2', '', 'Если подключение не работает'), note('Проверьте доступ в интернет, срок подписки, доступный лимит устройств и требуемый User-Agent. Состояние «Активно» означает, что служба запущена; оно не подтверждает доступность каждого сервера.')]),
      el('article', 'nf-form-card', [el('h2', '', 'Кто видит параметры?'), note('Пользовательская панель не выдаёт сохранённые ссылки и конфигурации. Это ограничение действует для учётной записи с ролью nimarkoflow-user. Root и другие административные роли могут прочитать данные устройства.')]),
      el('article', 'nf-form-card', [el('h2', '', 'Как работает маршрутизация?'), note('Весь трафик: направляет трафик клиентов через профиль. Выбранные сервисы: использует список russia_inside. При остановке службы обычная маршрутизация восстанавливается; блокировка трафика при обрыве здесь не включена.')])
    ])]);
    const panels = [overview, subscription, help];
    const tabs = ['Обзор', 'Подписка', 'Помощь'].map(function(title, index) {
      return E('button', { type: 'button', class: 'nf-nav-button', role: 'tab', id: 'nf-tab-' + index, 'aria-controls': 'nf-panel-' + index, click: function() { selectTab(index); }, keydown: function(event) { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3; selectTab(next); tabs[next].focus(); } } }, [icon(['grid', 'link', 'help'][index]), title]);
    });
    function selectTab(index) {
      panels.forEach(function(p, i) { p.hidden = i !== index; });
      tabs.forEach(function(t, i) { t.classList.toggle('nf-nav-button--active', i === index); t.setAttribute('aria-selected', i === index ? 'true' : 'false'); t.tabIndex = i === index ? 0 : -1; });
      // One label covers either source control, without exposing existing values.
    }
    panels.forEach(function(p, i) { p.id = 'nf-panel-' + i; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'nf-tab-' + i); });
    const css = E('link', { rel: 'stylesheet', href: L.resource('view/nimarkoflow/flow.css') });
    root.appendChild(css);
    root.appendChild(el('h2', 'nf-native-title', 'NimarkoFlow'));
    root.appendChild(E('nav', { class: 'nf-nav nf-native-tabs', role: 'tablist', 'aria-label': 'Разделы NimarkoFlow' }, tabs));
    const main = el('div', 'nf-main', panels);
    main.insertBefore(feedback, main.firstChild);
    root.appendChild(main);
    selectTab(0); update(state);
    poll.add(function() { return api.status().then(update).catch(function() { update({ available: false }); }); }, 5);
    return root;
  }
});
