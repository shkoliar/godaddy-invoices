require('dotenv').config()
var express = require('express');
var vo = require('vo');
var fs = require('fs');

const app = express();
const Nightmare = require('nightmare');		
const nightmare = Nightmare({ show: /^\s*(true|1|on)\s*$/i.test(process.env.SHOW_WINDOW),  typeInterval: 10, openDevTools: false });
nightmare.viewport(1024, 768);

var handlebars = require("handlebars");
var template = handlebars.compile(fs.readFileSync('wrapper.hbs', 'utf8'));

app.set('port', process.env.LISTEN_PORT);
app.use(express.static(__dirname + '/invoices'));

var run = function * () {
	let pages = {};
	let receipt_ids = [];
	let receipts = {};
	let year = process.argv && process.argv[2] ? process.argv[2] : new Date().getFullYear();

	yield nightmare
		.goto('https://sso.godaddy.com/?realm=idp&path=%2F&app=mya')
		.wait('input.username-input')
		.type('input.username-input', process.env.GODADDY_U)
		.type('input[type="password"]', process.env.GODADDY_P)
		.click('button#submitBtn')
		.wait('div.customer-menu')
		.goto('https://account.godaddy.com/orders')
		.wait('div.qa-order-list-item')
		.click('button.qa-toggle-filters')
		.click('input[value="date-pick"]')
		.evaluate(function(year) {
			let i = document.querySelector('input[name="date-range-from"]');
			i.value = '01.01.' + year;
			i.dispatchEvent(new Event('change'));
		}, year)
		.evaluate(function(year) {
			let i = document.querySelector('input[name="date-range-to"]');
			i.value = '31.12.' + year;
			i.dispatchEvent(new Event('change'));
		}, year)
		.click('body')
		.wait('div.qa-order-list-item')
		.wait('div.qa-load-more');

	let moreExists = yield nightmare.visible('div.qa-load-more');
    while (moreExists) {     
    	yield nightmare
    		.click('div.qa-load-more');

    	let loading = yield nightmare.wait(100).visible('div.tiny-loading-spinner');
		while (loading) {
			loading = yield nightmare.wait(100).visible('div.tiny-loading-spinner');
		}

        moreExists = yield nightmare.visible('div.qa-load-more');
    }

	yield nightmare.evaluate(function () {
		let ids = [];
		let container = document.querySelector('div.orders-container');
		let divs = container.querySelectorAll('div.qa-order-list-item');
		divs.forEach(qli => {
			let _tid = qli.querySelector('div.order-title').innerText.replace('#', '').trim();
			ids.push(_tid);
		});
		return ids;
	}).then((results)=> {
		receipt_ids = results;
		return pages;
	});

	for(var idx in receipt_ids) {
		yield page = function*() {
			let item = receipt_ids[idx];
			let html = "";
			let prefix = "GoDaddy_"+item;
			let pdf_file = `${prefix}.pdf`;
			let pdf_loc = `${__dirname}/invoices/${pdf_file}`;

			if(!fs.existsSync(pdf_loc)) {
				yield nightmare
					.goto('https://account.godaddy.com/orders/receipt/'+item)
					.wait('.modal-content > .liquid-container > .liquid-child > .payment-content')
					.wait(1000)
					.evaluate(function() {
						let o = document.querySelector('#order-modal');
						let ev = o.querySelectorAll('div.ember-view');

						Array.prototype.forEach.call(ev, function(element) {
						    element.removeAttribute('style');
						});

						o.removeChild(o.querySelector('button.close'));
						o.removeChild(o.querySelector('div.ember-view.disabled'));

						return o.innerHTML;
					}).then(function(result) {
						html = result
								.replace(/width\:[\s0-9]+px;\s+height\:[\s0-9]+px;/g,'')
								.replace(/opacity\:[\s.0-9]+;/g,'')
								.replace(/src\=\/\//g,'src=https://');
						receipts[item] = html;
						return html;
					});
			}
			return html;
		};
	};

	var server = app.listen(app.get('port'), function() {
		var port = server.address().port;
	});

	let rendered_pdfs = [];
	for(var idx in receipts) {
		let item = receipts[idx];
		yield pdfResult = function*() {
			let _r = item;
			let prefix = "GoDaddy_" + idx;
			let html_file = `${prefix}.html`;
			let pdf_file = `${prefix}.pdf`;
			let pdf_loc = `${__dirname}/invoices/${pdf_file}`;
			let html = template({innerHTML:_r});
			fs.writeFileSync(__dirname + '/invoices/' + html_file, html);
			return yield  nightmare
			.goto('http://127.0.0.1:' + process.env.LISTEN_PORT + '/' + html_file)
			.wait('div.ember-view')
			.pdf(pdf_loc)
			.then(function(err){
				console.log('render:', pdf_file);
				rendered_pdfs.push(pdf_file);
				fs.unlinkSync(__dirname + '/invoices/' + html_file)
				return true;
			}).catch(function (error) {
				done(error);
			})

		};
	};
	
	yield nightmare.end();
	return rendered_pdfs;
};


vo(run)(function(err, rendered_pdfs) {
	if(err){
		console.log(err);
	}
	if(!rendered_pdfs || rendered_pdfs.length == 0) {
		console.log('no new invoices');
	} else {
		console.log('rendered', rendered_pdfs.length, 'pdfs');
	}
	process.exit();
});
