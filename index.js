const http = require("http");
const paypal = require("paypal-rest-sdk");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = require("express")();
const ethers = require("ethers");

const { formatEther } = require("ethers/lib/utils");

const abiSource = require("./abi.json");

const senderAccount = "0xA1FE4119Ab59076B5d9062A32f9433f986F53130"; // your admin wallet adderss
const senderPrivateKey =
  "3882ff459d57e2686bcc5bae19e85b1d973c5ffaf4959ee6a6b69e374f035987"; // your private key
const INFURA_ID = "ca11249dabe247c1a6e0877c24376dda";
const provider = new ethers.providers.JsonRpcProvider(
  `https://goerli.infura.io/v3/${INFURA_ID}`
);

const client_id =
  "ARarXQ0FfqaGbdtIO71s4z-Dyxt5lA0ZfPJk9bq7Vg-wM9oDsWlU76W1bPPDKvYSfgQiQq_5E4nTxnOS"; // your paypal client id
const secret =
  "EHTkWlTnCqL9LWG51AsQlfp0WhBk3_Aey4ptGlyJgCqHfzjxoLGoJINwc-luW3-gupRCECOD3ohY8oWS"; // your paypal secret

//allow parsing of JSON bodies
app.use(cors());
app.use(bodyParser.json());

//configure for sandbox environment
paypal.configure({
  mode: "live", //sandbox or live
  client_id: client_id,
  client_secret: secret,
});

app.get("/create", function (req, res) {
  // console.log(data.walletAddress);
  // res.json(data.walletAddress);
  //build PayPal payment request
  const receiverAccount = req.query.walletAddress;
  const requestedAmount = req.query.paypalAmount / 1.5;
  const tokenChain = req.query.tokenChain;
  const wallet = new ethers.Wallet(senderPrivateKey, provider);

  const TokenContract = new ethers.Contract(
    // tokenChain === "Ethereum"
    //   ? "0x94f2eA0374d771801818Ad7b4A4F4552253F7A57"
    //   : "0xE972FFE67d612Aa258670525650e1419D439e050",
    abiSource.token.address,
    abiSource.token.abi,
    provider
  );

  const sendToken = async () => {
    const contractWithWallet = TokenContract.connect(wallet);

    const balance = await contractWithWallet.balanceOf(senderAccount);
    const tx = await contractWithWallet.transfer(
      receiverAccount,
      ethers.utils.parseUnits(requestedAmount.toString())
    );
    await tx.wait();
  };
  sendToken();
  console.log(receiverAccount);

  const payReq = JSON.stringify({
    intent: "sale",
    redirect_urls: {
      return_url: "http://localhost:3000",
      cancel_url: "http://localhost:3000",
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
  const paymentId = req.query.paymentId;
  const payerId = { payer_id: req.query.PayerID };

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
