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
  const cachedCards = new Map();
  let preloadTimer;

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

  function getCard(route, background = false) {
    if (!cachedCards.has(route)) cachedCards.set(route, createCard(route, background));
    return cachedCards.get(route);
  }

  function preloadNeighbors() {
    clearTimeout(preloadTimer);
    if (getComputedStyle(page).getPropertyValue('--touch-to-turn') !== 'enabled') return;
    preloadTimer = setTimeout(() => {
      for (const offset of [-1, 1]) {
        const route = adjacentRoute(offset);
        if (route) getCard(route, true);
      }
    }, 0);
  }

  function createCard(route, background) {
    const { title, kind, poem, imageFile } = pages.get(route);
    if (kind === 'cover') {
      const coverPage = cover.cloneNode(true);
      loadIllustration(coverPage.firstElementChild, imageFile, title, background);
      return coverPage;
    }

    const spread = spreadTemplate.content.firstElementChild.cloneNode(true);
    const heading = spread.querySelector('h1');
    const textPage = heading.parentElement;
    const artPage = spread.querySelector('.art-page');
    heading.textContent = title;
    heading.className = poem ? 'section-label' : 'spread-title';
    const fallback = placeholderTemplate.content.firstElementChild.cloneNode(true);
    let illustration = imageFile;
    let alt = poem ? 'Иллюстрация к хокку' : `Иллюстрация к альбому «${title}»`;

    if (kind === 'contents') {
      spread.classList.add('overview');
      artPage.append(contents.cloneNode(true));
      const contentsArt = document.createElement('div');
      contentsArt.className = 'contents-art';
      contentsArt.setAttribute('aria-hidden', 'true');
      contentsArt.append(fallback);
      spread.append(contentsArt);
      illustration = 'cover.webp';
      alt = '';
    } else {
      artPage.append(fallback);
      if (poem) textPage.append(createPoem(poem));
      else textPage.classList.add('album-title-page');
    }
    loadIllustration(fallback, illustration, alt, background);
    return spread;
  }

  function renderPage(previousRoute) {
    const route = pages.has(location.hash) ? location.hash : routes[0];
    const { title, kind } = pages.get(route);
    const index = routes.indexOf(route);
    verseObserver.disconnect();
    const card = getCard(route);
    touchGesture = undefined;
    clearSlide();
    page.replaceChildren(card);
    const nearby = routes.slice(Math.max(0, index - 1), index + 2);
    for (const route of cachedCards.keys()) {
      if (!nearby.includes(route)) cachedCards.delete(route);
    }
    preloadNeighbors();
    page.classList.remove('contents-pointer-active');
    mobileHeader.hidden = kind === 'cover';
    mobileHeading.textContent = title;
    if (kind === 'album' || kind === 'poem') mobileHeading.href = '#contents';
    else mobileHeading.removeAttribute('href');
    mobileStart.hidden = kind === 'contents';

    const verse = page.querySelector('.verse');
    if (verse) {
      verse.scrollLeft = 0;
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

  function loadIllustration(fallback, file, alt, background) {
    const image = new Image();
    image.alt = alt;
    image.className = 'illustration';
    if (background) image.fetchPriority = 'low';
    image.addEventListener('load', () => {
      fallback.replaceWith(image);
      if (background) image.decode().catch(() => {});
    }, { once: true });
    image.addEventListener('error', () => {
      if (file === 'placeholder.webp') fallback.hidden = false;
      else loadIllustration(fallback, 'placeholder.webp', 'Место для иллюстрации', background);
    }, { once: true });
    image.src = `images/${file}`;
  }

  function fitVerse() {
    sizeVerse(page.firstElementChild.querySelector('.verse'));
  }

  function sizeVerse(verse) {
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

  function adjacentRoute(offset) {
    const current = Math.max(0, routes.indexOf(location.hash));
    return routes[current + offset];
  }

  function turn(direction) {
    if (direction === 'start') {
      if (!start.hidden) location.hash = '#contents';
      return;
    }
    const route = adjacentRoute({ prev: -1, next: 1 }[direction]);
    if (route) location.hash = route;
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

  let touchGesture;
  let pageSlide;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function clearSlide() {
    if (!pageSlide) return;
    for (const animation of pageSlide.animations ?? []) animation.cancel();
    pageSlide.card.style.removeProperty('transform');
    pageSlide.preview.style.removeProperty('transform');
    pageSlide.preview.remove();
    pageSlide.preview.inert = false;
    pageSlide.preview.classList.remove('page-preview');
    page.classList.remove('page-sliding');
    pageSlide = undefined;
  }

  function slideTransform(offset) {
    return `translateX(${offset}px)`;
  }

  function moveSlide(card, dx) {
    const side = Math.sign(dx);
    const route = side ? adjacentRoute(-side) : undefined;
    if (pageSlide && (pageSlide.route !== route || reducedMotion.matches)) clearSlide();
    if (!route || reducedMotion.matches) return;
    if (!pageSlide) {
      const preview = getCard(route);
      preview.inert = true;
      preview.classList.add('page-preview');
      page.classList.add('page-sliding');
      page.append(preview);
      const verse = preview.querySelector('.verse');
      if (verse) {
        verse.scrollLeft = 0;
        sizeVerse(verse);
      }
      const viewport = page.getBoundingClientRect();
      const incoming = preview.getBoundingClientRect();
      const offset = side < 0 ? viewport.right - incoming.left : viewport.left - incoming.right;
      pageSlide = { route, card, preview, offset, exit: side * viewport.width, fromHash: location.hash };
    }
    const distance = side * Math.min(Math.abs(dx), Math.abs(pageSlide.offset));
    card.style.transform = slideTransform(distance);
    pageSlide.preview.style.transform = slideTransform(pageSlide.offset + distance);
  }

  function settleSlide(complete) {
    const slide = pageSlide;
    if (!slide || slide.animations) return;
    const { card, preview, offset, exit, route, fromHash } = slide;
    const animateTo = (element, target) => element.animate(
      [{ transform: element.style.transform }, { transform: slideTransform(target) }],
      { duration: 180, easing: 'ease-out', fill: 'forwards' },
    );
    slide.animations = [animateTo(card, complete ? exit : 0), animateTo(preview, complete ? 0 : offset)];
    Promise.all(slide.animations.map(animation => animation.finished)).then(() => {
      if (pageSlide !== slide) return;
      if (complete && location.hash === fromHash) location.hash = route;
      else clearSlide();
    }, () => {
      // Navigation or a resize can cancel the animations.
    });
  }

  page.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touchGesture = undefined;
    settleSlide(false);
    if (pageSlide) return;
    if (!event.isPrimary || getComputedStyle(page).getPropertyValue('--touch-to-turn') !== 'enabled') return;
    const card = event.target.closest('.cover, .spread');
    if (!card || event.target.closest('a, button, .verse[tabindex]')) return;
    touchGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, card, moved: false };
    page.setPointerCapture(event.pointerId);
  });
  page.addEventListener('pointermove', event => {
    if (touchGesture?.id !== event.pointerId) return;
    const dx = event.clientX - touchGesture.x;
    const dy = event.clientY - touchGesture.y;
    if (!touchGesture.moved && Math.hypot(dx, dy) > 10) {
      touchGesture.moved = true;
      touchGesture.horizontal = Math.abs(dx) > 1.5 * Math.abs(dy);
    }
    if (touchGesture.horizontal && window.getSelection().isCollapsed) moveSlide(touchGesture.card, dx);
  });
  function cancelTouch(event) {
    if (touchGesture?.id !== event.pointerId) return;
    touchGesture = undefined;
    settleSlide(false);
  }
  page.addEventListener('pointercancel', cancelTouch);
  page.addEventListener('lostpointercapture', cancelTouch);
  page.addEventListener('pointerup', event => {
    if (touchGesture?.id !== event.pointerId) return;
    const { x, y, card, moved, horizontal } = touchGesture;
    touchGesture = undefined;
    if (!card.isConnected || !window.getSelection().isCollapsed) {
      settleSlide(false);
      return;
    }
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if ((!moved || horizontal) && Math.abs(dx) >= 48 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      moveSlide(card, dx);
      if (pageSlide) settleSlide(true);
      else turn(dx < 0 ? 'next' : 'prev');
    } else if (!moved && Math.hypot(dx, dy) <= 10) {
      const { left, width } = card.getBoundingClientRect();
      turn(x < left + width / 2 ? 'prev' : 'next');
    } else {
      settleSlide(false);
    }
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
  window.addEventListener('resize', () => {
    touchGesture = undefined;
    clearSlide();
    preloadNeighbors();
  });
  renderPage();
  controls.hidden = false;
  document.fonts.ready.then(fitVerse);
})();
