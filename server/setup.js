const handler = {
    get (t, p, r) {
        if (p === "querySelectorAll") {
            return () => [];
        }
        return global.super_stub;
    },
    set (t, p, v, r) {
        return true;
    },
    apply (t, that, args) {
        return global.super_stub;
    },
    construct (t, a) {
        return global.super_stub_object;
    }
};
global.super_stub_object = new Proxy({}, handler);
global.super_stub = new Proxy(function(){}, handler);
global.document = global.super_stub;
global.use_ssr = true;

require("./index.js");