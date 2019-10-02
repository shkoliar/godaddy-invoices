require('dotenv').config()
var express = require('express');
var vo = require('vo');
var fs = require('fs');

const app = express();
const Nightmare = require('nightmare');		
const nightmare = Nightmare({ show: process.env.SHOW_WINDOW,  typeInterval: 10, openDevTools: false });
nightmare.viewport(1024, 768);

var handlebars = require("handlebars");
var template = handlebars.compile(fs.readFileSync('wrapper.hbs','utf8'));

app.set('port', process.env.LISTEN_PORT);
app.use(express.static(__dirname + '/invoices'));

var run = function * () {
	let pages = {};
	let receipt_ids = [];
	let receipts = {};

	yield nightmare
	.goto('https://sso.godaddy.com/?realm=idp&path=%2F&app=mya')
	.wait('input.username-input')
	.type('input.username-input', process.env.GODADDY_U)
	.type('input[type="password"]', process.env.GODADDY_P)
	.click('button#submitBtn')
	.wait('div.customer-menu')
	.goto('https://account.godaddy.com/orders')
	.wait('div.qa-order-list-item')
	.evaluate(function () {
		let ids = [];
		let container = document.querySelector('div.orders-container');
		let divs = container.querySelectorAll('div.qa-order-list-item');
		divs.forEach(qli => {
			let _tid = qli.querySelector('div.order-title').innerText.replace('#','').trim();
			ids.push(_tid);
		});
		return ids;
	}).then((results)=> {
		receipt_ids = results;
		return pages;
	});

	for(var idx in receipt_ids) {
		yield page = function*(){
			let item = receipt_ids[idx];
			let html = "";
			let prefix = "GoDaddy_"+item;
			let pdf_file = `${prefix}.pdf`;
			let pdf_loc = `${__dirname}/invoices/${pdf_file}`;

			if(!fs.existsSync(pdf_loc)){
				yield nightmare
				.goto('https://account.godaddy.com/orders/receipt/'+item)
				.wait('div.order-action-tray')
				.wait(3000)
				.evaluate(function(){
					let o = document.querySelector('div.ember-modal-dialog-center');
					let ev = o.querySelector('div.ember-view > div.ember-view');
					ev.style="";
					return o.innerHTML;
				}).then(function(result){
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
		yield pdfResult = function*(){
			let _r = item;
			let prefix = "GoDaddy_"+idx;
			let html_file = `${prefix}.html`;
			let pdf_file = `${prefix}.pdf`;
			let pdf_loc = `${__dirname}/invoices/${pdf_file}`;
			let html = template({innerHTML:_r});
			fs.writeFileSync(__dirname + '/invoices/' + html_file, html);
			return yield  nightmare
			.goto('http://127.0.0.1:'+process.env.LISTEN_PORT+'/'+html_file)
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
	if(rendered_pdfs.length == 0) {
		console.log('no new invoices');
	} else {
		console.log('rendered', rendered_pdfs.length, 'pdfs');
	}
	process.exit();
});

