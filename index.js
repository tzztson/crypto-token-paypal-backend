const http = require("http");
const paypal = require("paypal-rest-sdk");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = require("express")();

var client_id =
  "AR8-AT4aaOkFmVx0JA_k3mztM5L8IKb8FoUv1i4hmHg_FOhCokxK83u9i1inrzBKtjjxrntnkp8I3Izf";
var secret =
  "ENiSA2nDVuhsmPnQq979b1cUGJd_dStCYeU1WjKG28Ity8E_Qo9Lh0_7gMLlbivm0_NvQI-S51YfrQ1m";

//allow parsing of JSON bodies
app.use(cors("http://localhost:3000"));
app.use(bodyParser.json());

//configure for sandbox environment
paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id: client_id,
  client_secret: secret,
});

app.get("/create", function (req, res) {
  // console.log(data.walletAddress);
  // res.json(data.walletAddress);
  //build PayPal payment request
  console.log(req.query);

  var payReq = JSON.stringify({
    intent: "sale",
    redirect_urls: {
      return_url: "http://localhost:3000/",
      cancel_url: "http://localhost:8000/cancel",
    },
    payer: {
      payment_method: "paypal",
    },
    transactions: [
      {
        amount: {
          total: req.query.paypalAmount > 0 ? req.query.paypalAmount : "10",
          // total: "12",
          currency: "USD",
        },
        description: "This is the payment transaction description.",
      },
    ],
  });

  paypal.payment.create(payReq, function (error, payment) {
    if (error) {
      console.error(error);
    } else {
      //capture HATEOAS links
      var links = {};
      payment.links.forEach(function (linkObj) {
        links[linkObj.rel] = {
          href: linkObj.href,
          method: linkObj.method,
        };
      });

      //if redirect url present, redirect user
      if (links.hasOwnProperty("approval_url")) {
        res.json({ forwardLink: links["approval_url"].href });
      } else {
        console.error("no redirect URI present");
      }
    }
  });
});

app.get("/process", function (req, res) {
  var paymentId = req.query.paymentId;
  var payerId = { payer_id: req.query.PayerID };

  paypal.payment.execute(paymentId, payerId, function (error, payment) {
    if (error) {
      console.error(error);
    } else {
      if (payment.state == "approved") {
        res.send("payment completed successfully");
      } else {
        res.send("payment not successful");
      }
    }
  });
});

http.createServer(app).listen(8000, function () {
  console.log("Server started: Listening on port 8000");
});
