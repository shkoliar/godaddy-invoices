# godaddy-invoices

Use nightmare to login to GoDaddy, grab all invoice data and render to pretty PDFs

Edit `example.env`, save as `.env` then:

```
npm i
node godaddy.js [year]
```

If the year parameter is omitted, the current year will be used.