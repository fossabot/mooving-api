var errorText = {
  "001": "Please enter a valid card number",
  "002": "Please enter the CVV/CVC of your card",
  "003": "Please enter a valid expiration date",
  "22013": "This card type is not supported",
  default: "Something went wrong... Please try again later",
  };

var cardUrl = {
  AmericanExpress: "https://files.readme.io/97e7acc-Amex.png",
  CarteBleau: "https://files.readme.io/5da1081-cb.png",
  DinersClub: "https://files.readme.io/8c73810-Diners_Club.png",
  Discover: "https://files.readme.io/caea86d-Discover.png",
  JCB: "https://files.readme.io/e076aed-JCB.png",
  MaestroUK: "https://files.readme.io/daeabbd-Maestro.png",
  MasterCard: "https://files.readme.io/5b7b3de-Mastercard.png",
  Solo: "https://bluesnap.com/services/hosted-payment-fields/cc-types/solo.png",
  Visa: "https://files.readme.io/9018c4f-Visa.png"
};
var cardLogo = document.getElementById("card-logo");
var ccnLabel = document.getElementById("ccn-label");
var cvvLabel = document.getElementById("cvv-label");
var expLabel = document.getElementById("exp-label");
var labels = {
  ccn: ccnLabel,
  cvv: cvvLabel,
  exp: expLabel,
}
var platform = navigator && navigator.platform && navigator.platform.indexOf("iPhone") > -1 ? "iOS" : "Android";
var bsObj = {
  onFieldEventHandler: {
    onFocus: function(tagId) {
      labels[tagId].style.color = "#a0a0a0";
      labels[tagId].classList.remove('swing');
    },
    onBlur: function(tagId) {},
    onError: function(tagId, errorCode, errorDescription) {
      markErrors([errorCode]);
    },
    onType: function(tagId, cardType, cardData) {
      cardLogo.src = cardUrl[cardType];
    },
    onValid: function(tagId) {
    }
  },
  style: {
    // Styling all inputs
    input: {
      "color": "#000",
      "font-size": "100%",
    },
    span: {
      "color": "#000",
      "font-size": "18px",
      "line-height": "32px",
    },
    select: {
      "width": "62px",
      "line-height": "30px",
    },
    ".invalid": {
      "color": "#FF4163",
    },
    ".invalid:focus": {
      "color": "#000",
    },
  },
  ccnPlaceHolder: "1234 5678 9012 3456",
  cvvPlaceHolder: "123",
  expPlaceHolder: "MM/YY",
  expDropDownSelector: platform === "iOS",
};
var isTokenExpired = false;
function submitCard() {
  bluesnap.submitCredentials(function(callback) {
    if (callback.error) {
      var errorArray = callback.error;
      unmarkErrors();
      markErrors(errorArray.map(function(error) {
        return error.errorCode;
      }));
      window.postMessage(
        JSON.stringify({
          status: "error",
          details: errorArray,
        })
      );
    } else {
      unmarkErrors();
      window.postMessage(
        JSON.stringify({
          status: "submitted"
        })
      );
    }
  });
}

function unmarkErrors() {
  ccnLabel.style.color = "#a0a0a0";
  cvvLabel.style.color = "#a0a0a0";
  expLabel.style.color = "#a0a0a0";
}

function markErrors(errorArray) {
  for (var i in errorArray) {
    switch (errorArray[i]) {
      case '001':
        ccnLabel.style.color = "#FF4163";
        ccnLabel.classList.add('swing');
        break;
      case '002':
        cvvLabel.style.color = "#FF4163";
        cvvLabel.classList.add('swing');
        break;
      case '003':
        expLabel.style.color = "#FF4163";
        expLabel.classList.add('swing');
        break;
      case '14040': 
        isTokenExpired = true;
        window.postMessage(
          JSON.stringify({
            status: "token-expired"
          }));      
        break;
    }
  }
}

function createPaymentFields(token) {
  bluesnap.hostedPaymentFieldsCreation(token, bsObj);
  window.postMessage(
    JSON.stringify({
      status: "loading-completed"
    }));
}

createPaymentFields = createPaymentFields.bind(this);
var token;
document.addEventListener("message", function(e) {
  const message = JSON.parse(e.data);
  if (message.type === "token") {
    if (!token) {
      createPaymentFields(message.token);
      token = message.token;
    }
    if (token && isTokenExpired) {
      bluesnap.updateBSToken(message.token);
      token = message.token;
    }
    isTokenExpired = false;
  } else if (message.type === "submit") {
    submitCard();
  }
});
