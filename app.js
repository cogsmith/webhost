// app.js --ip 0.0.0.0 --port 80 --www W:\DEV\WEB --redirect foo.com=bar.com -r 127.0.0.1/foo=127.0.0.1/bar -r /foo=/bar -r /g=https://google.com

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');

const fastify = require('fastify');

const AppJSON = require('./package.json');
const AppMeta = {
    Version: AppJSON.version || process.env.npm_package_version || '0.0.0',
    Name: AppJSON.namelong || AppJSON.name || 'App',
    Info: AppJSON.description || '',
}; AppMeta.Full = AppMeta.Name + ': ' + AppMeta.Info + ' [' + AppMeta.Version + ']';

const AppArgs =
    yargs(process.argv).wrap(125)
        .usage("\n" + AppMeta.Full + "\n\n" + 'USAGE: node $0 [options]')
        .epilog('DT: ' + new Date().toISOString() + "\n\n" + process.argv.join(' ') + "\n")
        .demandOption(['ip', 'port', 'base', 'www'])
        .describe('v', 'Logging Level').default('v', 0).alias('v', 'verbose').count('verbose')
        .describe('ip', 'Bind IP').default('ip', '127.0.0.1')
        .describe('port', 'Bind Port').default('port', 80)
        .describe('base', 'Web Base Prefix').default('base', '/')
        .describe('www', 'Web Root Path') // .default('www',path.join(process.cwd(),'www'))
        .describe('redirect', 'Web Redirects').alias('r', 'redirect').array('redirect')
        .describe('list', 'Web Listings').default('list', false)
        .showHelp('log')
        .argv; console.log(); // console.log(AppArgs);

const App = {
    AppJSON: AppJSON,
    Args: AppArgs,
    Meta: AppMeta,
    Requests: 0,
    Clients: {},
    Port: AppArgs.port,
    IP: AppArgs.ip,
    WebRoot: AppArgs.www,
    WebBase: AppArgs.base,
    WebList: AppArgs.list
};

//

App.GetHostSlug = function (host) { if (!host) { return host; } let slug = host.replace(/\./g, '_').toUpperCase(); let z = slug.split('_'); if (z.length >= 3) { slug = z.slice(-2).join('_') + '_' + z.slice(0, z.length - 2).reverse().join('_'); }; return slug; };
App.GetSlugHost = function (slug) { if (!slug) { return slug; } let host = slug.split('/')[0].replace(/_/g, '.'); let path = slug.split('/').slice(1).join('/') || ''; let z = host.split('.'); if (z.length >= 2) { host = z.slice(2).reverse().join('.') + '.' + z.slice(0, 2).join('.'); }; return host + (path ? '/' + path : ''); }

//

App.InitInfo = function () {
    App.SetInfo('App', function () { return 'WEBHOST' });
}

App.Init = function () {

    App.Backend = {};
    App.Backend.Fastify = fastify({
        logger: true, maxParamLength: 999, ignoreTrailingSlash: false, trustProxy: App.Args.xhost,
        rewriteUrl: function (req) {
            let url = req.url;
            let host = App.Args.xhost ? req.headers['x-forwarded-host'] : req.headers['host'];
            if (!url.includes('.') && url.substr(-1) != '/') { url += '/'; }
            // console.log({ HOST: host, URL: url, REQ: { URL: req.url, H: req.headers } });
            if (App.Args.vhost) { url = '/' + App.GetHostSlug(host) + '/web/raw/@' + url; }
            return url;
        }
    });

    let ff = App.Backend.Fastify;

    ff.log.info('App.Init');

    //ff.register(require('fastify-compress'));

    ff.addHook('onRequest', (req, rep, nxt) => {
        let reqip = req.socket.remoteAddress;
        App.Requests++; if (!App.Clients[reqip]) { App.Clients[reqip] = 1; } else { App.Clients[reqip]++; }
        nxt();
    });

    ff.setNotFoundHandler((req, rep) => {
        let p = App.WebRoot;
        if (App.Args.vhost) { p = p + '/' + App.GetHostSlug(req.hostname) + '/web/raw/@'; }

        // console.log({ P: p, HOST: req.hostname, URL: req.url }); // , REQ: { URL: req.url, H: req.headers } });

        if (fs.existsSync(p + '/404/index.html')) { rep.redirect('/404'); }
        else if (fs.existsSync(p + '/404.html')) { rep.redirect('/404.html'); }
        else { rep.code(404).send(); }
    });

    let ff_list = {
        format: 'html', names: ['_.html'],
        render: (dirs, files) => {
            //console.log({DIRS:dirs,FILES:files});
            return `
                    <html>
                        <head>
                            <zbase href="http://127.0.0.1:80/www/">
                            <zbase target="_blank">
                        </head>
                        <body>
                            <ul>${dirs.map(dir => `<li><a href="${App.WebBase + dir.href}/">${dir.name}</a></li>`).join('\n  ')}</ul>
                            <hr/>
                            <ul>${files.map(file => `<li><a href="${file.href.replace('\\', '')}" target="_blank">${file.name}</a></li>`).join('\n  ')}</ul>
                        </body>
                    </html>
                `
        },
    };

    ff.register(require('fastify-static'), {
        root: App.WebRoot,
        prefix: App.WebBase,
        list: (App.WebList ? ff_list : false),
        preCompressed: true,
        // prefixAvoidTrailingSlash: true,
        // redirect: true,
    });

    ff.listen(App.Port, App.IP, (err, address) => { if (err) { throw err; } else { ff.log.info('App.Init:Done'); App.Main(); } });
};

App.Main = function () {
    console.log('App.Main');
};

App.Init();
