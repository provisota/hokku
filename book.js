(() => {
  const pages = new Map([
    ['#cover', { title: 'Хокку', kind: 'cover', imageFile: 'cover.webp' }],
    ['#contents', { title: 'Оглавление', kind: 'contents' }],
  ]);
  for (const [key, album] of Object.entries(albums)) {
    pages.set(`#${key}`, { title: album.name, kind: 'album', imageFile: `album-${key}.webp` });
    for (const id of album.poems) {
      const number = id.slice('hokku-'.length);
      pages.set(`#${key}/${id}`, { title: album.name, kind: 'poem', poem: poems[id], imageFile: `image-${number}.webp` });
    }
  }
  const routes = [...pages.keys()];

  const page = document.querySelector('#page');
  const mobileHeader = document.querySelector('.mobile-header');
  const mobileHeading = mobileHeader.querySelector('.mobile-heading a');
  const mobileStart = mobileHeader.querySelector('[data-turn="start"]');
  const controls = document.querySelector('.book-controls');
  const counter = controls.querySelector('.paging p');
  const previous = controls.querySelector('[data-turn="prev"]');
  const next = controls.querySelector('[data-turn="next"]');
  const start = controls.querySelector('[data-turn="start"]');
  const cover = page.firstElementChild.cloneNode(true);
  const spreadTemplate = document.querySelector('#spread-template');
  const placeholderTemplate = document.querySelector('#placeholder-template');
  const verseObserver = new ResizeObserver(fitVerse);

  const contents = document.createElement('ul');
  for (const [key, album] of Object.entries(albums)) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${key}`;
    link.textContent = album.name;
    item.append(link);
    contents.append(item);
  }

  function createPoem({ lines, date, time, place, note }) {
    const verse = document.createElement('blockquote');
    verse.className = 'verse';
    for (const line of lines) {
      const span = document.createElement('span');
      span.className = 'verse-line';
      span.textContent = line;
      if (verse.childNodes.length) verse.append('\n');
      verse.append(span);
    }

    const dating = [place, [date, time].filter(Boolean).join(' ')].filter(Boolean).join('  ');
    const metadata = [dating, note].filter(Boolean).join('\n');
    const fragment = document.createDocumentFragment();
    fragment.append(verse);
    if (metadata) {
      const caption = document.createElement('p');
      caption.className = 'meta';
      caption.textContent = metadata;
      fragment.append(caption);
    }
    return fragment;
  }

  function renderPage(previousRoute) {
    const route = pages.has(location.hash) ? location.hash : routes[0];
    const { title, kind, poem, imageFile } = pages.get(route);
    const index = routes.indexOf(route);
    verseObserver.disconnect();
    page.classList.remove('contents-pointer-active');
    mobileHeader.hidden = kind === 'cover';
    mobileHeading.textContent = title;
    if (kind === 'album' || kind === 'poem') mobileHeading.href = '#contents';
    else mobileHeading.removeAttribute('href');
    mobileStart.hidden = kind === 'contents';

    if (kind === 'cover') {
      const coverPage = cover.cloneNode(true);
      page.replaceChildren(coverPage);
      loadIllustration(coverPage.firstElementChild, imageFile, title);
    } else {
      const spread = spreadTemplate.content.cloneNode(true);
      const heading = spread.querySelector('h1');
      const textPage = heading.parentElement;
      const artPage = spread.querySelector('.art-page');
      heading.textContent = title;
      heading.className = poem ? 'section-label' : 'spread-title';
      const fallback = placeholderTemplate.content.firstElementChild.cloneNode(true);
      let illustration = imageFile;
      let alt = poem ? 'Иллюстрация к хокку' : `Иллюстрация к альбому «${title}»`;

      if (kind === 'contents') {
        spread.firstElementChild.classList.add('overview');
        artPage.append(contents.cloneNode(true));
        const contentsArt = document.createElement('div');
        contentsArt.className = 'contents-art';
        contentsArt.setAttribute('aria-hidden', 'true');
        contentsArt.append(fallback);
        spread.firstElementChild.append(contentsArt);
        illustration = 'cover.webp';
        alt = '';
      } else {
        artPage.append(fallback);
        if (poem) textPage.append(createPoem(poem));
        else textPage.classList.add('album-title-page');
      }
      page.replaceChildren(spread);
      loadIllustration(fallback, illustration, alt);
    }

    const verse = page.querySelector('.verse');
    if (verse) {
      verseObserver.observe(verse);
      fitVerse();
    }

    counter.textContent = `${index + 1} / ${routes.length}`;
    counter.setAttribute('aria-label', `Страница ${index + 1} из ${routes.length}`);
    previous.disabled = index === 0;
    next.disabled = index === routes.length - 1;
    start.hidden = kind === 'cover' || kind === 'contents';
    document.title = kind === 'cover' ? title : `${title} · Хокку`;

    if (previousRoute !== undefined) {
      window.scrollTo(0, 0);
      if (kind === 'contents' && pages.has(previousRoute)) {
        const albumRoute = previousRoute.split('/')[0];
        const albumLink = page.querySelector(`.overview a[href="${albumRoute}"]`);
        if (albumLink) {
          albumLink.focus();
          return;
        }
      }
      const focused = document.activeElement;
      if (!controls.contains(focused) || focused.disabled || focused.hidden) {
        page.focus({ preventScroll: true });
      }
    }
  }

  function loadIllustration(fallback, file, alt) {
    const image = new Image();
    image.alt = alt;
    image.className = 'illustration';
    image.addEventListener('load', () => {
      if (fallback.isConnected) fallback.replaceWith(image);
    }, { once: true });
    image.addEventListener('error', () => {
      if (!fallback.isConnected) return;
      if (file === 'placeholder.webp') fallback.hidden = false;
      else loadIllustration(fallback, 'placeholder.webp', 'Место для иллюстрации');
    }, { once: true });
    image.src = `images/${file}`;
  }

  function fitVerse() {
    const verse = page.querySelector('.verse');
    if (!verse) return;
    verse.style.removeProperty('font-size');
    const longestLine = Math.max(...Array.from(verse.children, line => line.getBoundingClientRect().width));
    if (longestLine > verse.clientWidth) {
      const defaultSize = Number.parseFloat(getComputedStyle(verse).fontSize);
      const minSize = 0.875 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const fittedSize = defaultSize * (verse.clientWidth - 1) / longestLine;
      verse.style.fontSize = `${Math.max(minSize, fittedSize)}px`;
    }
    if (verse.scrollWidth > verse.clientWidth) verse.tabIndex = 0;
    else verse.removeAttribute('tabindex');
  }

  function turn(direction) {
    const current = Math.max(0, routes.indexOf(location.hash));
    if (direction === 'start') {
      if (!start.hidden) location.hash = '#contents';
      return;
    }
    const index = { prev: current - 1, next: current + 1 }[direction];
    if (index !== current && routes[index]) location.hash = routes[index];
  }

  function handleContentsKey(event) {
    const links = [...page.querySelectorAll('.overview a')];
    const focusedIndex = links.indexOf(document.activeElement);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const last = links.length - 1;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const index = focusedIndex < 0
        ? (step > 0 ? 0 : last)
        : Math.max(0, Math.min(last, focusedIndex + step));
      event.preventDefault();
      links[index].focus();
    } else if (focusedIndex >= 0 && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (!event.repeat) links[focusedIndex].click();
    }
  }

  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-turn]');
    if (button) turn(button.dataset.turn);
  });
  mobileStart.addEventListener('click', () => turn('start'));

  let pendingTap;
  page.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    pendingTap = undefined;
    if (!event.isPrimary || getComputedStyle(page).getPropertyValue('--tap-to-turn') !== 'enabled') return;
    const card = event.target.closest('.cover, .spread');
    if (!card || event.target.closest('a, button, .verse[tabindex]')) return;
    pendingTap = { id: event.pointerId, x: event.clientX, y: event.clientY, card };
  });
  page.addEventListener('pointermove', event => {
    if (pendingTap?.id === event.pointerId &&
        Math.hypot(event.clientX - pendingTap.x, event.clientY - pendingTap.y) > 10) {
      pendingTap = undefined;
    }
  });
  page.addEventListener('pointercancel', event => {
    if (pendingTap?.id === event.pointerId) pendingTap = undefined;
  });
  page.addEventListener('pointerup', event => {
    if (pendingTap?.id !== event.pointerId) return;
    const { x, y, card } = pendingTap;
    pendingTap = undefined;
    if (!card.isConnected || Math.hypot(event.clientX - x, event.clientY - y) > 10 ||
        !window.getSelection().isCollapsed) return;
    const { left, width } = card.getBoundingClientRect();
    turn(x < left + width / 2 ? 'prev' : 'next');
  });

  page.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch' && event.target.closest('.overview')) {
      page.classList.add('contents-pointer-active');
    }
  });
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (location.hash === '#contents' && event.key === 'Tab') {
      page.classList.remove('contents-pointer-active');
    }
    if (event.shiftKey) return;
    if (location.hash === '#contents') {
      handleContentsKey(event);
      if (event.defaultPrevented) {
        page.classList.remove('contents-pointer-active');
        return;
      }
    }
    const direction = { ArrowLeft: 'prev', ArrowRight: 'next', ArrowUp: 'start' }[event.key];
    if (!direction) return;
    const verse = page.querySelector('.verse');
    if (direction !== 'start' && verse && verse === document.activeElement && verse.scrollWidth > verse.clientWidth) return;
    event.preventDefault();
    turn(direction);
  });
  window.addEventListener('hashchange', event => renderPage(new URL(event.oldURL).hash));
  renderPage();
  controls.hidden = false;
  document.fonts.ready.then(fitVerse);
})();
