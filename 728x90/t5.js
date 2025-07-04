const util = {
    store: [],
    datesList: [],
    index: 0,
    debug: false,
    clear() {
        this.store.length = 0;
    },
    dates(input, q){
        let d = new URLSearchParams(location.search).get(q)
        this.datesList = input;
        if(d){
            this.index = d;
        }else{
            for(let i in this.datesList){ if(new Date() > new Date(this.datesList[i])) this.index =  i }
        }
    },
    set(div, file, date=null, size=null, lazy=true) {
        const isArray = Array.isArray;
        let type = (date && size) ? "cta" : (size && date == '') ? "button" : date ? "date" : "element";
        let files = isArray(file) ? file : [file];
        let sizes = isArray(size) ? size : [size];
        let dates = isArray(date) ? date : (date !== null ? [date] : []);

        let multiInput = files.length > 1 && sizes.length > 1;
        
        if (multiInput && (!isArray(date) || files.length !== dates.length || sizes.length !== dates.length)) {
            console.log(div, files.length, sizes.length, dates.length)
            this.store.push({
                div,
                file: files[0],
                date: dates[0] || null,
                size: sizes[0] || null,
                type,
                lazy
            })
            return
        }
        const maxLen = Math.max(files.length, dates.length, sizes.length);
        for (let i = 0; i < maxLen; i++) {
            this.store.push({lazy, div, type, file: files[i] ?? files[files.length - 1], date:dates[i] ?? null, size: sizes[i] ?? sizes[sizes.length - 1]})
        }
    },
    get(type){
            return type ? this.store.filter(i => (i.type === type) && (type === 'button' || type === 'element' || i.date === this.datesList[this.index])) : this.store;
    }
};

function handleAssetElement(_element, _date, _cta, _button){
    _element.forEach(i => z('#ad').div(i.div).css({backgroundImage: `url(${i.file})`}))
    _date.forEach(i => z('#ad').div(i.div).css({backgroundImage: `url(${i.file})`}))
    _cta.forEach(i => z('#ad').div(i.div).metaAutoSize().css({backgroundImage: `url(${i.file})`}).tap(onClick, onRoll, onOut))
    _button.forEach(i => z('#ad').div(i.div).css(i.size))
}
function createTimeline(b, c, d){
    let x;
    if(b){
        x = gsap.timeline({paused: true});
        if(d) x.target = d
        x.addLabel('start');
        eval(b)(x, `#${d}`)
        x.addLabel('end');
    }
    return x;
}