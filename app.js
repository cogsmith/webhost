//app.js --ip 0.0.0.0 --port 80 --www W:\DEV\WEB --redirect foo.com=bar.com -r 127.0.0.1/foo=127.0.0.1/bar -r /foo=/bar -r /xyz=https://google.com

const path = require('path');
const yargs = require('yargs/yargs');

const fastify = require('fastify')({ 
    logger:true, maxParamLength:999, ignoreTrailingSlash:false, 
    rewriteUrl: function (req) { var url = req.url;
        if (!url.includes('.') && url.substr(-1)!='/') { url += '/'; }
        return url;
    }
 });

const AppJSON = require('./package.json');
const AppMeta = {
    Version:AppJSON.version||process.env.npm_package_version||'0.0.0',
    Name:AppJSON.namelong||AppJSON.name||'App',
    Info:AppJSON.description||'',
}; AppMeta.Full = AppMeta.Name + ': ' + AppMeta.Info + ' [' + AppMeta.Version + ']';

const AppArgs = 
    yargs(process.argv).wrap(125)
    // .command(['serve','$0'],'Run Server')
    .usage("\n"+AppMeta.Full+"\n\n"+'USAGE: node $0 [options]')
    .epilog('DT: '+new Date().toISOString()+"\n\n"+process.argv.join(' ')+"\n")
    .demandOption(['ip','port','base','www'])
    .describe('v','Logging Level').default('v',0).alias('v','verbose').count('verbose')                
    .describe('ip','Bind IP').default('ip','127.0.0.1')
    .describe('port','Bind Port').default('port',80)
    .describe('base','Web Base Prefix').default('base','/')
    .describe('www','Web Root Path') // .default('www',path.join(process.cwd(),'www'))
    .describe('redirect','Web Redirects').alias('r','redirect').array('redirect')
    .describe('list','Web Listings').default('list',false)
    .showHelp('log')
.argv; console.log();

console.log(AppArgs);

const App = { 
    AppJSON:AppJSON,
    Args:AppArgs,
    Meta:AppMeta,
    Requests:0,
    Clients:{},
    Port:AppArgs.port,
    IP:AppArgs.ip,
    WebRoot:AppArgs.www,
    WebBase:AppArgs.base,
    WebList:AppArgs.list
};

App.Init = function () {
    fastify.log.info('App.Init'); 

    fastify.register(require('fastify-compress'));

    fastify.addHook('onRequest', (req,rep,nxt) => { 
        let reqip = req.socket.remoteAddress;
        App.Requests++; if (!App.Clients[reqip]) { App.Clients[reqip]=1; } else { App.Clients[reqip]++; }
        nxt();
    });

    // fastify.setNotFoundHandler((req,rep) => { rep.redirect('/404'); });
    fastify.setNotFoundHandler((req,rep) => { rep.code(404).send('404:NOTFOUND'); });

    fastify_list = {
            format:'html', names:['_.html'],
            render: (dirs,files) => {
                //console.log({DIRS:dirs,FILES:files});
                return `
                    <html>
                        <head>
                            <zbase href="http://127.0.0.1:80/www/">
                            <zbase target="_blank">
                        </head>
                        <body>
                            <ul>${dirs.map(dir => `<li><a href="${App.WebBase+dir.href}/">${dir.name}</a></li>`).join('\n  ')}</ul>
                            <hr/>
                            <ul>${files.map(file => `<li><a href="${file.href.replace('\\','')}" target="_blank">${file.name}</a></li>`).join('\n  ')}</ul>
                        </body>
                    </html>
                `
            },
    };

    fastify.register(require('fastify-static'), {
        root:   App.WebRoot,
        prefix: App.WebBase,
        // prefixAvoidTrailingSlash: true,
        // redirect: true,
        list: (App.WebList ? fastify_list : false )
    });

    fastify.listen(App.Port, App.IP, (err,address) => { if (err) { throw err; } else { fastify.log.info('App.Init:Done'); App.Main(); } } );
};

App.Main = function () {
    fastify.log.info('App.Main'); 
};

App.Init();