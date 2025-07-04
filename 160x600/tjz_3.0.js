const animationQueues = new WeakMap(); // For animation chaining
const activeAnimations = new WeakMap();

// Utilities outside z()
const shorthand = {
    x: 'translateX', y: 'translateY',
    sx: 'scaleX', sy: 'scaleY',
    rx: 'rotateX', ry: 'rotateY',
    tx: 'translateX', ty: 'translateY', tz: 'translateZ',
    blur: 'blur', brightness: 'brightness',
    contrast: 'contrast', grayscale: 'grayscale',
    sepia: 'sepia', hueRotate: 'hue-rotate',

    w: 'width', h: 'height',
    l: 'left', r: 'right', t: 'top', b: 'bottom',

    m: 'margin', mt: 'marginTop', mb: 'marginBottom', ml: 'marginLeft', mr: 'marginRight',
    mx: ['marginLeft', 'marginRight'], my: ['marginTop', 'marginBottom'],
    p: 'padding', pt: 'paddingTop', pb: 'paddingBottom', pl: 'paddingLeft', pr: 'paddingRight',
    px: ['paddingLeft', 'paddingRight'], py: ['paddingTop', 'paddingBottom'],

    fs: 'fontSize', fw: 'fontWeight', lh: 'lineHeight', ta: 'textAlign',
    td: 'textDecoration', tt: 'textTransform', ls: 'letterSpacing',

    d: 'display', jc: 'justifyContent', ai: 'alignItems', fd: 'flexDirection',
    fwf: 'flexWrap', g: 'gap', gg: 'gridGap', gr: 'gridRow', gc: 'gridColumn',

    br: 'borderRadius', bw: 'borderWidth', bs: 'boxShadow',
    bt: 'borderTop', bb: 'borderBottom', bl: 'borderLeft', brd: 'borderRight',

    bg: 'background', bc: 'borderColor', c: 'color', o: 'opacity',
    vis: 'visibility', cp: 'clipPath', msk: 'maskImage',

    z: 'zIndex', pointer: 'pointerEvents', pe: 'pointerEvents', cur: 'cursor',
    hueRotate: 'hue-rotate', dropShadow: 'drop-shadow'
};

const transformProps = [
        'translateX', 'translateY', 'translateZ',
        'scaleX', 'scaleY', 'scaleZ', 'scale',
        'rotateX', 'rotateY', 'rotateZ', 'rotate',
        'skewX', 'skewY', 'skew',
        'perspective',
        'translate', 'translate3d',
        'scale3d', 'rotate3d',
        'matrix', 'matrix3d'
    ];

const filterProps = [
    'blur', 'brightness', 'contrast',
    'grayscale', 'hue-rotate', 'invert',
    'saturate', 'sepia',
    'drop-shadow'
];

//const filterProps = ['blur', 'brightness', 'contrast', 'grayscale', 'sepia', 'hue-rotate', 'invert', 'saturate', 'drop-shadow']; 

const isColor = (value) => {
    const el = document.createElement('div');
    el.style.color = '';
    el.style.color = value;
    return !!el.style.color;
};

const applyUnit = (prop, value) => {
    const unitlessProps = ['opacity', 'zIndex', 'flexGrow', 'flexShrink', 'lineHeight'];
    const keywordValues = ['none', 'auto', 'inherit', 'initial', 'unset', 'normal', 'bold'];
    if (unitlessProps.includes(prop) || (typeof value === 'string' && (keywordValues.includes(value) || /%|px|em|rem|vh|vw|calc\(|var\(/.test(value)))) { // Added 'var(' for CSS variables
        return value;
    }
    return typeof value === 'number' ? `${value}px` : value;
};

const applyStyleFunction = (el, prop, obj, unitMap = {}) => {
    const existing = el.style[prop] || '';
    const regex = /(\w+-?\w*)\(([^)]+)\)/g;
    const existingMap = {};
    let match;
    while ((match = regex.exec(existing)) !== null) {
        const [, key, val] = match;
        existingMap[key] = val;
    }

    for (const k in obj) {
        const val = obj[k];
        if (val == null || val === '')delete existingMap[k];
        else existingMap[k] = val;
    }

    const str = Object.entries(existingMap).map(([k, v]) => {
        const unit = unitMap[k] || '';
        return `${k}(${typeof v === 'number' ? v + unit : v})`;
    }).join(' ');
    el.style[prop] = str;
};

const applyTransform = (el, obj) => {
    applyStyleFunction(el, 'transform', obj, {
        translate: 'px', translateX: 'px', translateY: 'px', translateZ: 'px',
        rotate: 'deg', rotateX: 'deg', rotateY: 'deg', rotateZ: 'deg',
        skew: 'deg', skewX: 'deg', skewY: 'deg',
        perspective: 'px',
        scale: '', scaleX: '', scaleY: '', scaleZ: '', scale3d: '',
        matrix: '', matrix3d: '', translate3d: '', rotate3d: ''
    });
};


const applyFilter = (el, obj) => {
    applyStyleFunction(el, 'filter', obj, {
        blur: 'px', grayscale: '%', brightness: '', contrast: '', sepia: '',
        'hue-rotate': 'deg', invert: '%', saturate: '', 'drop-shadow': '' // drop-shadow value includes units
    });
};

const cssVar = (elements, name, value) => {
    if (value !== undefined) {
        elements.forEach(el => el.style.setProperty(name, value));
    } else {
        return getComputedStyle(elements[0]).getPropertyValue(name);
    }
};

const parseRelative = (start, end) => {
    const s = parseFloat(start);
    const e = typeof end === 'string' && /^[+\-]=/.test(end) ? s + parseFloat(end.substring(2)) : parseFloat(end);
    return e;
};

const getTransformStartValue = (el, prop) => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    switch (prop) {
        case 'translateX': return matrix.m41;
        case 'translateY': return matrix.m42;
        case 'scaleX': return matrix.a;
        case 'scaleY': return matrix.d;
        default: return 0;
    }
};

function styleFunctionHelper(ctx, cssProp, fnName, values, unit = '') {
    const obj = {};
    obj[fnName] = values.length > 1 ? values.map(v => typeof v === 'number' ? v + unit : String(v)).join(', ') : (typeof values[0] === 'number' ? values[0] + unit : String(values[0]));

    if (cssProp === 'transform') ctx.elements.forEach(el => applyTransform(el, obj));
    else if (cssProp === 'filter') ctx.elements.forEach(el => applyFilter(el, obj));
    
    return ctx;
}

const transformHelper = (ctx, prop, values, unit = '') => styleFunctionHelper(ctx, 'transform', prop, values, unit);
const filterHelper = (ctx, prop, values, unit = '') => styleFunctionHelper(ctx, 'filter', prop, values, unit);

function setStyle(elements, prop, val) {
    const applySingleStyle = (el, key, value) => {
        if (key === 'transform') {
            if (typeof value === 'string') el.style.transform = (el.style.transform || '') ? `${el.style.transform} ${value}` : value
            else applyTransform(el, value) 
        } else if (key === 'filter') {
            if (typeof value === "string") el.style.filter = (el.style.filter || '') ? `${el.style.filter} ${value}` : value
            else applyFilter(el, value)
        } else if (key === 'background') {
            el.style.background = isColor(value) ? value : `url(${value}) center/cover no-repeat`;
        } else if (key === 'pointerEvents') {
            el.style.pointerEvents = value === false ? 'none' : value === true ? 'auto' : value;
        } else if (key.startsWith('--')) {
            cssVar([el], key, value);
        } else {
            el.style[key] = value;
        }
    };

    const isColorVal = (v) => typeof v === 'string' && isColor(v);
    const elementsArray = Array.isArray(elements) ? elements : [elements];

    if (typeof prop === 'object') {
        const tf = {}, fl = {};

        for (let p in prop) {
            let v = prop[p];
            let m = shorthand[p] || p;

            if (Array.isArray(m)) {
                m.forEach(mp => elementsArray.forEach(el => el.style[mp] = isColorVal(v) ? v : applyUnit(mp, v)));
                continue; 
            }

            const resolvedPropName = m;

            if (transformProps.includes(resolvedPropName)) {
                tf[resolvedPropName] = v;
                continue;
            }

            if (filterProps.includes(resolvedPropName)) {
                fl[resolvedPropName] = v;
                continue;
            }

            const value = isColorVal(v) ? v : applyUnit(resolvedPropName, v);
            elementsArray.forEach(el => applySingleStyle(el, resolvedPropName, value));
        }

        if (Object.keys(tf).length) elementsArray.forEach(el => applyTransform(el, tf));
        if (Object.keys(fl).length) elementsArray.forEach(el => applyFilter(el, fl));

    } else if (typeof prop === 'string' && val !== undefined) {
        let p = shorthand[prop] || prop;
        let v = isColorVal(val) ? val : applyUnit(p, val);

        if (Array.isArray(p)) p.forEach(mp => elementsArray.forEach(el => el.style[mp] = v));
        else elementsArray.forEach(el => applySingleStyle(el, p, v));
    }
}

function insertContent(target, position, content) {
    const isHTML = typeof content === 'string';
    const isZ = content && content.elements && content.elements.length > 0; // Check for actual elements
    const elementsToInsert = isZ ? content.elements : (content instanceof Element ? [content] : []);

    if (isHTML) {
        target.insertAdjacentHTML(position, content);
    } else if (elementsToInsert.length) {
        elementsToInsert.forEach((el, i) => { // 'i' is now correctly passed
            const node = (i === 0 && target.contains(el)) ? el : el.cloneNode(true);
            switch (position) {
                case 'beforebegin': target.parentNode.insertBefore(node, target); break;
                case 'afterbegin': target.insertBefore(node, target.firstChild); break;
                case 'beforeend': target.appendChild(node); break;
                case 'afterend': target.parentNode.insertBefore(node, target.nextSibling); break;
            }
        });
    }
}

function getEasingFunction(easing) {
    const easingPresets = {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
        easeInQuart: t => t * t * t * t,
        easeOutQuart: t => 1 - (--t) * t * t * t,
        easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
        easeInQuint: t => t * t * t * t * t,
        easeOutQuint: t => 1 + (--t) * t * t * t * t,
        easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
        easeInSine: t => 1 - Math.cos((t * Math.PI) / 2),
        easeOutSine: t => Math.sin((t * Math.PI) / 2),
        easeInOutSine: t => -0.5 * (Math.cos(Math.PI * t) - 1),
        easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
        easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
        easeInOutExpo: t => t === 0 || t === 1 ? t : t < 0.5 ? Math.pow(2, 10 * (2 * t - 1)) / 2 : (2 - Math.pow(2, -10 * (2 * t - 1))) / 2,
        easeInCirc: t => 1 - Math.sqrt(1 - t * t),
        easeOutCirc: t => Math.sqrt(1 - (--t) * t),
        easeInOutCirc: t => t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (--t) * t) + 1) / 2,
        easeInBack: t => t * t * t - t * Math.sin(t * Math.PI),
        easeOutBack: t => 1 + (--t) * t * t - t * Math.sin(t * Math.PI),
        easeInOutBack: t => t < 0.5 ? (2 * t * t * t - 2 * t * Math.sin(t * Math.PI)) / 2 : 1 + (2 * (--t) * t * t - 2 * t * Math.sin(t * Math.PI)) / 2,
        easeInElastic: t => t === 0 || t === 1 ? t : Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI),
        easeOutElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1,
        easeInOutElastic: t => t === 0 || t === 1 ? t : t < 0.5 ? (Math.pow(2, 10 * (2 * t - 1)) * Math.sin((2 * t - 1.1) * 5 * Math.PI)) / 2 : (Math.pow(2, -10 * (2 * t - 1)) * Math.sin((2 * t - 1.1) * 5 * Math.PI) + 2) / 2,
        easeInBounce: t => 1 - easingPresets.easeOutBounce(1 - t),
        easeOutBounce: t => t < (1 / 2.75) ? 7.5625 * t * t : t < (2 / 2.75) ? 7.5625 * (t -= (1.5 / 2.75)) * t + 0.75 : t < (2.5 / 2.75) ? 7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375 : 7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375,
        easeInOutBounce: t => t < 0.5 ? easingPresets.easeInBounce(t * 2) * 0.5 : easingPresets.easeOutBounce(t * 2 - 1) * 0.5 + 0.5
    };
    function spring(stiffness = 1, mass = 80, damping = 10, velocity = 0) {
        return t => {
            const w0 = Math.sqrt(stiffness / mass);
            const zeta = damping / (2 * Math.sqrt(stiffness * mass));
            const a = 1;
            const b = -velocity;

            if (zeta < 1) {
                const wd = w0 * Math.sqrt(1 - zeta * zeta);
                return a * Math.exp(-zeta * w0 * t) *
                (Math.cos(wd * t) + (zeta * w0 + b) / wd * Math.sin(wd * t));
            } else {
                return 1 - Math.exp(-stiffness * t);
            }
        };
    }
    function cubicBezier(p0, p1, p2, p3) {
        return t => {
            const cx = 3 * p0;
            const bx = 3 * (p2 - p0) - cx;
            const ax = 1 - cx - bx;
            const cy = 3 * p1;
            const by = 3 * (p3 - p1) - cy;
            const ay = 1 - cy - by;
            const bezier = t => {
                const x = ((ax * t + bx) * t + cx) * t;
                const y = ((ay * t + by) * t + cy) * t;
                return y;
            }
        return bezier(t);
        };
    }

    if (typeof easing === 'function') return easing;

    if (typeof easing === 'string') {
        
        const springMatch = easing.match(/^spring\(([^)]+)\)$/);
        if (springMatch) {
            const [s = 1, m = 80, d = 10, v = 0] = springMatch[1].split(',').map(Number);
            return spring(s, m, d, v);
        }

        const bezierMatch = easing.match(/^cubicBezier\(([^)]+)\)$/);
        if (bezierMatch) {
            const [x1, y1, x2, y2] = bezierMatch[1].split(',').map(Number);
            return cubicBezier(x1, y1, x2, y2);
        }

        if (easingPresets[easing]) return easingPresets[easing];
    }
    return easingPresets.linear;
}

function getPropFromTransformOrFilter(el, prop) {
    const style = window.getComputedStyle(el);
    if (transformProps.includes(prop)) {
        const transform = style.transform;
        let match;
        if (!transform || transform === 'none') return 0;

        if(prop == 'scale'){
            match = transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(parseFloat);
            const scaleX = match[0]; // matrix[0] represents scaleX
            const scaleY = match[3];
            return { scaleX, scaleY } || 1
        }else{
            match = transform.match(new RegExp(`${prop.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')}\\(([^)]+)\\)`));

            if (match) {
                const raw = match[1].trim();
                const num = parseFloat(raw);
                return isNaN(num) ? raw : num;
            }
            return 0;
        }
        
        //const match = transform.match(new RegExp(`${prop.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')}\\(([^)]+)\\)`));
        
        //const match = transform.match(/scale\(([^)]+)\)/);
        //const match = transform.match(new RegExp(`${prop}\\(([^)]+)\\)`));
        //console.log(">>>", prop, match)
        
        
    }

    if (filterProps.includes(prop)) {
        
        const filter = style.filter;
        if (!filter || filter === 'none') return 0;

        const match = filter.match(new RegExp(`${prop}\\(([^)]+)\\)`));
        if (match) {
        const raw = match[1].trim();
        const num = parseFloat(raw);
        return isNaN(num) ? raw : num;
        }
        return 0;
    }

    // Not a transform or filter prop, fallback to standard style
    const raw = style.getPropertyValue(prop);
    const num = parseFloat(raw);
    return isNaN(num) ? raw : num;
}

function animateElement(el, props, options = {}, onDone = () => {}) {
    //console.log(el, props)
    const duration = (options.duration || 0.5) * 1000;
    const delay = (options.delay || 0) * 1000;
    const easing = getEasingFunction(options.easing || 'linear');
    const onStart = options.onStart || (() => {});
    const onUpdate = options.onUpdate || (() => {});
    const onComplete = options.onComplete || (() => {});
    const onProgress = options.onProgress || (() => {});
    const onPause = options.onPause || (() => {});
    const startOverride = options.startValues || null;
    const startValues = {};
    const endValues = {};
    const computed = getComputedStyle(el);

    for (let prop in props) {
        const fullProp = shorthand[prop] || prop;
        const to = props[prop]
        let from;

        //console.log("kajang", fullProp, getTransformStartValue(el, fullProp), getComputedStyle(el).getPropertyValue(fullProp))
        if(startOverride && fullProp in startOverride){
            from = startOverride[fullProp];
        }else if(transformProps.includes(fullProp) || filterProps.includes(fullProp)) {
            
            if(fullProp.includes('scale')){
                const style = window.getComputedStyle(el).transform
                
                console.log(style)
                
                //match = style.match(/matrix\(([^)]+)\)/)[1].split(',').map(parseFloat);
                //const scaleX = match[0]; // matrix[0] represents scaleX
                //const scaleY = match[3];
                //console.log(scaleX, scaleY, scaleX == scaleY)
                //if(scaleX == scaleY) return scaleX
            }else if(fullProp.includes('brightness') || fullProp.includes('contrast' || fullProp.includes('saturate'))){
                from = getPropFromTransformOrFilter(el, fullProp) ? parseFloat(getPropFromTransformOrFilter(el, fullProp)) : 1
            }else{
                from = parseFloat(getTransformStartValue(el, fullProp)) || parseFloat(getPropFromTransformOrFilter(el, fullProp)) || 0;
            }
        } else if (isColor(to)) {
            from = parseColor(computed.getPropertyValue(fullProp));
        } else {
            from = parseFloat(computed.getPropertyValue(fullProp)) || 0;
        }

        startValues[fullProp] = from;
        endValues[fullProp] = isColor(to) ? parseColor(to) : to

        //console.log("from", from, startValues, ">>>>",endValues[fullProp])
    }

    let startTime;
    let rafId;
    let paused = false;
    let pauseTime = 0;
    let elapsedAtPause = 0;
    let progressOverride = null;

    function tick(now) {
        if (!startTime) startTime = now;
        if(paused) return
        const elapsed = now - startTime;
        //let t = progressOverride !== null ? progressOverride : Math.min(1, elapsed / duration);
        let t = Math.min(1, elapsed / duration);
        //console.log(t)
        var easedT = easing(t);

        const currentStyles = {};

        for (let prop in endValues) {
            const from = startValues[prop];
            const to = endValues[prop];
            
            if (isColor(to)) {
                currentStyles[prop] = mixColor(from, to, easedT);
            } else {
                const value = from + (to - from) * easedT;
                currentStyles[prop] = value;
            }
        }
        //console.log(currentStyles["translateX"])
        setStyle(el, currentStyles);
        onUpdate(easedT);
        onProgress(t, el)
        if (t < 1) {
            rafId = requestAnimationFrame(tick);
        } else {
            onComplete();
            onDone()
        }
    }

    setTimeout(() => {
        onStart();
        rafId = requestAnimationFrame(tick);
    }, delay);

    return {
        play: () => {
            if (!rafId && !paused) {
                onStart();
                rafId = requestAnimationFrame(tick);
            } else if (paused) {
                paused = false;
                startTime += performance.now() - pauseTime;
                rafId = requestAnimationFrame(tick);
            }
        },
        
        seek: (t) => {
            const progress = Math.max(0, Math.min(t, 1))
            const easedT = easing(progressOverride);
            const currentStyles = {};
            
            for (let prop in endValues) {
                const from = startValues[prop];
                const to = endValues[prop];
                if (transformProps.includes(to) || filterProps.includes(to)) {
                    currentStyles[prop] = getPropFromTransformOrFilter(el, to);
                } else if (isColor(to)) {
                    currentStyles[prop] = parseColor(computed.getPropertyValue(to));
                } else {
                    const raw = computed.getPropertyValue(to);
                    const parsed = parseFloat(raw);
                    currentStyles[prop] = isNaN(to) ? raw : parsed;
                }
                setStyle(el, currentStyles);
            }

            if (typeof options.onProgress === 'function') {
                options.onProgress(progress);
            }
            progressOverride = progress;
        },
        from: startValues,
        to: endValues,
        duration,
        pause: () => {
            if(!paused){
                paused = true;
                pauseTime = performance.now();
                onPause(el)
                cancelAnimationFrame(rafId)
            }
        },
        resume: () => {
            if(paused){
                paused = false;
                const now = performance.now()
                const pauseDuration = now - pauseTime;
                startTime += pauseDuration;
                rafId = requestAnimationFrame(tick)
            }
        },
        stop: () => {
            cancelAnimationFrame(rafId);
            setStyle(el, endValues);
            onComplete();
            onDone()
        }
    };
}

function queueAnimation(el, props, options = {}, isFrom = false, preStyle) {
    if (!animationQueues.has(el)) animationQueues.set(el, []);
    const queue = animationQueues.get(el);

    const run = () => {
        const {onStart, onEnd, onProgress, onPause } = options;
        if (typeof onStart === 'function') onStart(el);

        const onComplete = () => {
            if (typeof onEnd === 'function') onEnd(el);
            //console.log(queue)
            queue.shift();
            if (queue.length > 0) queue[0]();
        };

        const commonOptions = {
            ...options,
            onProgress: typeof onProgress === 'function' ? (p) => onProgress(p, el) : undefined,
            onPause: typeof onPause === 'function' ? () => onPause(el) : undefined,
        };

        if(isFrom){
            const fromStyles = {};
            const toStyles = {};
            const computed = getComputedStyle(el);


            for (let prop in props) {
                
                const fullProp = shorthand[prop] || prop;
                const fromValue = props[prop];
                let toValue;

                
                if (transformProps.includes(fullProp) || filterProps.includes(fullProp)) {
                    if(fullProp.includes('scale') || fullProp.includes('brightness') || fullProp.includes('contrast' || fullProp.includes('saturate'))){
                        toValue = getPropFromTransformOrFilter(el, fullProp) ? parseFloat(getPropFromTransformOrFilter(el, fullProp)) : 1
                    }else{
                        toValue = getPropFromTransformOrFilter(el, fullProp);
                    }
                } else if (isColor(fromValue)) {
                    toValue = parseColor(computed.getPropertyValue(fullProp));
                } else {
                    const raw = computed.getPropertyValue(fullProp);
                    const parsed = parseFloat(raw);
                    toValue = isNaN(parsed) ? raw : parsed;
                }

                fromStyles[fullProp] = fromValue;
                toStyles[fullProp] = toValue;
            }

            setStyle(el, fromStyles); // Immediately apply starting style
            return animateElement(el, toStyles, { ...commonOptions, startValues: fromStyles }, onComplete);
        }else{
            //console.log(props)
            animateElement(el, props, commonOptions, onComplete);
        }
        /* */
        /*const controller = isFrom ? () => {
            const fromStyles = {};
            const toStyles = {};
            const computed = getComputedStyle(el);


            for (let prop in props) {
                const fullProp = shorthand[prop] || prop;
                const fromValue = props[prop];
                let toValue;

                if (transformProps.includes(fullProp) || filterProps.includes(fullProp)) {
                    toValue = getPropFromTransformOrFilter(el, fullProp);
                } else if (isColor(fromValue)) {
                    toValue = parseColor(computed.getPropertyValue(fullProp));
                } else {
                    const raw = computed.getPropertyValue(fullProp);
                    const parsed = parseFloat(raw);
                    toValue = isNaN(parsed) ? raw : parsed;
                }

                fromStyles[fullProp] = fromValue;
                toStyles[fullProp] = toValue;
            }

            setStyle(el, fromStyles); // Immediately apply starting style
            return animateElement(el, toStyles, { ...commonOptions, startValues: fromStyles }, onComplete);
        } : () => animateElement(el, props, commonOptions, onComplete);*/

        //console.log(controller)
        //const animController = controller()
        //const id = options.id;
        //if (!activeAnimations.has(el)) activeAnimations.set(el, {});
        //const animations = activeAnimations.get(el);
        //if (id) {
        //    console.log('Storing animation controller', { id, animController }); // ✅ Debug
         //   animations[id] = animController;
        //}
    };

    queue.push(run);
    if (queue.length === 1) run();
}

function extractOptionsFromProps(obj) {
    const animOptions = ['id', 'duration', 'delay', 'easing', 'onStart', 'onEnd', 'onComplete', 'onProgress', 'onPause'];
    const props = {}, options = {};
    for (let key in obj) {
        if (animOptions.includes(key)) options[key] = obj[key];
        else props[key] = obj[key];
    }

    if(!options.easing && options.ease){
        options.easing = options.ease
    }
    delete options.ease;
    if(!options.onEnd && options.onComplete){
        options.onEnd = options.onComplete
    }
    delete options.onComplete;
    return { props, options };
}
function computeDelay(options, i) {
    if (!options.stagger) return 0;
    return (typeof options.stagger === 'number') ? options.stagger * i : 0.1 * i;
}
function z(selector) {
    const listenersMap = new WeakMap();
    const elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
    this.elements = elements instanceof NodeList ? Array.from(elements) : Array.isArray(elements) ? elements.filter(Boolean) : [elements].filter(Boolean); // 
    
    this.html = function(content) {
        if (content === undefined) return this.elements[0]?.innerHTML;
        this.elements.forEach(el => el.innerHTML = content);
        return this;
    };
    
    this.text = function(content) {
        if (content === undefined) return this.elements[0]?.textContent;
        this.elements.forEach(el => el.textContent = content);
        return this;
    };

    this.div = function(selector, classNames = "", styleObj = {}){
        if(typeof selector !== 'string') return this;

        const exists = document.querySelector(selector);
            if (!exists) {
                const id = selector.replace(/^#/, '');
                const el = document.createElement('div');
                el.id = id;
                el.classList.add('full');
                (classNames.match(/\S+/g) || []).forEach(cls => el.classList.add(cls));
                Object.entries(styleObj).forEach(([k, v]) => el.style[k] = v);
                this.elements.forEach(i => i.appendChild(el))
            }
        return z(selector);
    },

    this.metaAutoSize = function(meta = document.querySelector('meta[name="ad.size"]').content, defaults = { width: 300, height: 250 }, center = false){
        function getAdSize(meta){
            try {
                const pairs = meta.split(',');
                const result = {};

                for (const pair of pairs) {
                    const [key, value] = pair.split('=');
                    const num = parseInt(value.replace(/[^\d]/g, ''), 10);
                    if (key && !isNaN(num)) {
                        result[key.trim()] = num;
                    }
                }
                return { ...defaults, ...result };
            } catch (e) {
                return defaults;
            }
        }
        this.css(getAdSize(meta))
        if (center) this.css({ display: 'flex', alignItems: 'center', justifyContent: 'center'});
        return this
    };

    this.on = function(type, handler, options) {
        this.elements.forEach(el => {
            el.addEventListener(type, handler, options);
            if (!listenersMap.has(el)) listenersMap.set(el, []);
            listenersMap.get(el).push({ type, handler });
        });
        return this;
    };

    this.off = function(type, handler) {
        this.elements.forEach(el => {
            const listeners = listenersMap.get(el) || [];
            const remaining = listeners.filter(l => !(l.type === type && l.handler === handler));
            if (listeners.length !== remaining.length) { // Only remove if a matching listener was found
                el.removeEventListener(type, handler);
                listenersMap.set(el, remaining);
            }
        });
        return this;
    };

    this.events = function(events, handler) {
        events.split(' ').forEach(event => {
            this.on(event, handler);
        });
        return this;
    };

    this.click = function(fn) {
        return this.on('click', fn);
    };

    this.hoverin = function(fn) {
        return this.on('ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'touchstart' : 'mouseenter', fn);
    };

    this.hoverout = function(fn) {
        return this.on('ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'touchend' : 'mouseleave', fn);
    };

    this.tap = function(clickFn, enterFn, leaveFn) {
        this.css({ cursor: 'pointer', pointerEvents: 'auto' });

        if (clickFn) this.click(clickFn);
        if (enterFn) this.hoverin(enterFn);
        if (leaveFn) this.hoverout(leaveFn);

        return this;
    };

    this.attr = function(name, value) {
        if (value === undefined) return this.elements[0]?.getAttribute(name);
        this.elements.forEach(el => el.setAttribute(name, value));
        return this;
    };

    this.addClass = function(className) {
        this.elements.forEach(el => el.classList.add(...className.split(' ')));
        return this;
    };

    this.removeClass = function(className) {
        this.elements.forEach(el => el.classList.remove(...className.split(' ')));
        return this;
    };

    this.toggleClass = function(className) {
        this.elements.forEach(el => className.split(' ').forEach(cls => el.classList.toggle(cls)));
        return this;
    };

    this.hasClass = function(className) {
        return this.elements[0]?.classList.contains(className) || false;
    };

    this.insert = function(content, position = 'beforeend') {
        this.elements.forEach(el => insertContent(el, position, content));
        return this;
    };
    this.append = function(content) { return this.insert(content, 'beforeend'); };
    this.prepend = function(content) { return this.insert(content, 'afterbegin'); };
    this.before = function(content) { return this.insert(content, 'beforebegin'); };
    this.after = function(content) { return this.insert(content, 'afterend'); };
    this.clone = function() {
        const clones = this.elements.map(el => el.cloneNode(true));
        return z(clones);
    };
    this.all = function() {
        return this.elements;
    };
    this.find = function(selector) {
        const found = [];
        this.elements.forEach(el => found.push(...el.querySelectorAll(selector)));
        return z(found);
    };
    this.parent = function() {
        const parents = this.elements.map(el => el.parentNode).filter(Boolean);
        return z([...new Set(parents)]); // Use Set to get unique parents
    };
    this.children = function() {
        const kids = [];
        this.elements.forEach(el => kids.push(...el.children));
        return z(kids);
    };
    this.css = function(prop, val) {
        if (typeof prop === 'string' && val === undefined) return this.elements[0] ? getComputedStyle(this.elements[0])[prop] : undefined;
        setStyle(this.elements, prop, val);
        return this;
    };

    this.pause = function(id) {
        this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            if (!controllers) return;
            if (id && controllers[id]) controllers[id].pause?.();
            else Object.values(controllers).forEach(ctrl => ctrl.pause?.());
        });
        return this;
    };

    this.resume = function(id) {
        this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            if (!controllers) return;
            if (id && controllers[id]) controllers[id].resume?.();
            else Object.values(controllers).forEach(ctrl => ctrl.resume?.());
        });
        return this;
    };

    this.stop = function(id) {
        this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            if (!controllers) return;
            if (id && controllers[id]) controllers[id].stop?.();
            else Object.values(controllers).forEach(ctrl => ctrl.stop?.());
        });
        return this;
    };

    this.restart = function(id) {
        this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            if (!controllers) return;
            if (id && controllers[id]) {
                controllers[id].seek?.(0);
                controllers[id].play?.();
            }
        });
        return this;
    };

    this.play = function(id) {
        this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            if (!controllers) return;

            if (id && controllers[id]) {
                //controllers[id].seek?.(0);  // Reset to beginning
                controllers[id].play?.();
            } else {
                Object.values(controllers).forEach(ctrl => {
                    ctrl.seek?.(0);
                    ctrl.play?.();
                });
            }
        });
        /*this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            console.log('play()', { el, controllers }); // ✅ Debug            if (!controllers) return;
            if (id && controllers[id]) controllers[id].play?.();
            else Object.values(controllers).forEach(ctrl => ctrl.play?.());
        });*/
        return this;
    };

    this.seek = function(id, progress = 0) {
        this.elements.forEach(el => {
            const controllers = activeAnimations.get(el);
            if (!controllers) return;
            if (id && controllers[id]) {
                const ctrl = controllers[id]
                ctrl.seek?.(progress);
            }
        });
        return this;
    };

    this.from = function(props, options = {}){
        this.elements.forEach((el, i) => {
            const extracted = extractOptionsFromProps(props);
            const delay = (options.delay || 0) + computeDelay(options, i);
            queueAnimation(el, extracted.props, { ...options, ...extracted.options, delay: (extracted.options.delay || options.delay || 0) + delay}, true);
        });
        return this;
    };

    this.to = function(props, options = {}) {
        this.elements.forEach((el, i) => {
            const extracted = extractOptionsFromProps(props);
            const delay = (options.delay || 0) + computeDelay(options, i);
            queueAnimation(el, extracted.props, { ...options,  ...extracted.options, delay: (extracted.options.delay || options.delay || 0) + delay });
        });
        return this;
    };

    // --- CSS Shorthand Methods ---
    this.margin = function(value) { return this.css('margin', value); };
    this.padding = function(value) { return this.css('padding', value); };
    this.width = function(value) { return this.css('width', value); };
    this.height = function(value) { return this.css('height', value); };
    this.size = function(width, height = width) { return this.css({ width, height }); };
    this.color = function(value) { return this.css('color', value); };
    this.bg = function(value) { return this.css('background', value); };
    this.bgCol = function(value) { return this.css('backgroundColor', value); };
    this.bgImg = function(value) { return this.css({ backgroundImage: value, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }); }; // Added more background properties for common use
    this.opacity = function(value) { return this.css('opacity', value); };
    this.visibility = function(value) { return this.css('visibility', value); };
    this.display = function(value) { return this.css('display', value); };
    this.overflow = function(value) { return this.css('overflow', value); };
    this.zIndex = function(value) { return this.css('z-index', value); };
    this.clipPath = function(value) { return this.css('clipPath', value); };
    this.maskImage = function(value) { return this.css('maskImage', value); };

    // --- Transform Methods ---
    this.rotate = function(...value) { return transformHelper(this, 'rotate', value, 'deg'); };
    this.rotateX = function(...value) { return transformHelper(this, 'rotateX', value, 'deg'); };
    this.rotateY = function(...value) { return transformHelper(this, 'rotateY', value, 'deg'); };
    this.rotateZ = function(...value) { return transformHelper(this, 'rotateZ', value, 'deg'); };
    this.skew = function(...value) { return transformHelper(this, 'skew', value, 'deg'); };
    this.skewX = function(...value) { return transformHelper(this, 'skewX', value, 'deg'); };
    this.skewY = function(...value) { return transformHelper(this, 'skewY', value, 'deg'); };
    this.scale = function(...value) { return transformHelper(this, 'scale', value); };
    this.scaleX = function(...value) { return transformHelper(this, 'scaleX', value); };
    this.scaleY = function(...value) { return transformHelper(this, 'scaleY', value); };
    this.scaleZ = function(...value) { return transformHelper(this, 'scaleZ', value); };
    this.translate = function(...value) { return transformHelper(this, 'translate', value, 'px'); };
    this.translateX = function(...value) { return transformHelper(this, 'translateX', value, 'px'); };
    this.translateY = function(...value) { return transformHelper(this, 'translateY', value, 'px'); };
    this.translateZ = function(...value) { return transformHelper(this, 'translateZ', value, 'px'); }; // Added 'px' unit for consistency, though 'px' is often default for translateZ
    this.perspective = function(...value) { return transformHelper(this, 'perspective', value, 'px'); }; // Perspective typically takes 'px'

    // --- Filter Methods ---
    this.blur = function(...value) { return filterHelper(this, 'blur', value, 'px'); };
    this.brightness = function(...value) { return filterHelper(this, 'brightness', value); }; // No unit or '%' is common
    this.contrast = function(...value) { return filterHelper(this, 'contrast', value); }; // No unit or '%' is common
    this.grayscale = function(...value) { return filterHelper(this, 'grayscale', value, '%'); };
    this.hueRotate = function(...value) { return filterHelper(this, 'hue-rotate', value, 'deg'); };
    this.invert = function(...value) { return filterHelper(this, 'invert', value, '%'); }; // Added missing filter
    this.saturate = function(...value) { return filterHelper(this, 'saturate', value); }; // Added missing filter, no unit or '%' is common
    this.sepia = function(...value) { return filterHelper(this, 'sepia', value, '%'); };
    this.dropShadow = function(...value) { return filterHelper(this, 'drop-shadow', value); }; // Added missing filter, takes string like '1px 1px 2px black'

    return this; // Return this to allow chaining
}