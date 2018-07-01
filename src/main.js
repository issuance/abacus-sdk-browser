import "@babel/polyfill";
import fetch from "isomorphic-unfetch";
import * as qs from "qs";

const AbacusError = (message, name) => {
  var instance = new Error("Abacus Err:" + message);
  instance.name = name || instance.name;
  return instance;
};

const parseJWT = token => {
  if (typeof token !== "string") return null;
  return JSON.parse(atob(token.split(".")[1]));
};

/**
 * Abacus SDK main class.
 */
class Abacus {
  /**
   * Instantiates the Abacus SDK.
   *
   * @param {Object} params
   * @param {Object} params.authToken An auth token to use the API with, if it exists.
   * @param {Object} params.applicationId The ID of your application. You can obtain this at https://identity.abacusprotocol.com/application/admin/create_application.
   * @param {Object} params.portalURL The URL to the Abacus Portal dApp.
   * @param {Object} params.apiURL The URL to the Abacus API.
   */
  constructor(params) {
    if (!params.applicationId)
      throw new AbacusError("Please provide an application ID.");
    this._opts = {
      portalURL: params.portalURL || "https://identity.abacusprotocol.com",
      apiURL: params.apiURL || "https://api.abacusprotocol.com",
      applicationId: params.applicationId
    };
    this.MODAL_ID = "abacusSDK";
    this._displaying = false;
    this._exists = false;
    if (typeof window === "undefined") {
      this._authUser = params.authToken;
    } else {
      this._authUser = params.authToken || window.localStorage.abacusUserToken;
    }
    this.baseURL = `${this._opts.apiURL}/api/v1`;
  }

  /**
   * Closes the modal if it's open.
   *
   * @param {function} onClose Called if and when the modal is closed.
   */
  closeModal(onClose) {
    const modal = document.getElementById(this.MODAL_ID);
    if (!modal) return;
    modal.parentNode.removeChild(modal);
    onClose();
  }

  /* AUTHENTICATION METHODS */

  /**
   * Opens the Abacus modal for login and (optionally) user verification.
   *
   * @param {Object} options
   * @param {function} onOpen Called when the modal is opened.
   * @param {function} onClose Called when the modal is closed.
   * @param {Boolean} runVerifications True if the modal should include the verifications flow for the application.
   */
  authorizeWithModal(options) {
    const OPTS = {
      onOpen:
        options && typeof options.onOpen === "function"
          ? options.onOpen
          : function() {},
      onClose:
        options && typeof options.onClose === "function"
          ? options.onClose
          : function() {},
      runVerifications: !!options.runVerifications || false
    };

    const query = {};
    if (this._opts.applicationId) {
      query.application = this._opts.applicationId;
    }
    if (OPTS.runVerifications) {
      query.requireKYC = "true";
    }

    const modal = document.createElement("iframe");
    modal.src = this._opts.portalURL + "/modal/login?" + qs.stringify(query);
    modal.width = "100%";
    modal.height = "100%";
    modal.frameBorder = "0";
    modal.style.position = "fixed";
    modal.style.zIndex = "1337";
    modal.id = this.MODAL_ID;
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.overflow = "hidden";
    document.body.appendChild(modal);
    modal.style.display = "block";

    if (!this._exists) {
      window.addEventListener("click", event => {
        if (event.target != modal && this._displaying) {
          this.closeModal(OPTS.onClose);
        }
      });
      window.addEventListener("message", event => {
        if (event.data.name !== "abacus") return;
        if (event.data.payload === "modal_close") {
          this.closeModal(OPTS.onClose);
        }
        if (event.data.payload.appToken) {
          this._authUser = event.data.payload.appToken;
          window.localStorage.abacusUserToken = this._authUser;
        }
      });
    }

    // weird hack for ensuring event listener doesn't fire
    setTimeout(function() {
      this._displaying = true;
      OPTS.onOpen();
    }, 1);
    this._exists = true;
  }

  async _sendRequest(url, data, mergeOpts = {}) {
    const res = await fetch(this.baseURL + url, {
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer " + this._authUser
      },
      ...mergeOpts
    });
    return await res.json();
  }

  async _sendGetRequest(url, data) {
    return await this._sendRequest(url, data);
  }

  async _sendPostRequest(url, data) {
    return await this._sendRequest(url, data, {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  readAuthToken() {
    return parseJWT(this._authUser);
  }

  /**
   * get information from jwt token
   * @returns {Object} auth information
   */
  getAuthorizedUser() {
    const { exp, address, applicationId } = this.readAuthToken();
    return {
      expires: exp,
      address,
      applicationId
    };
  }

  /**
   * deactivate the currently logged in user
   */
  deauthorize() {
    this._authUser = null;
    window.localStorage.abacusUserToken = null;
  }

  /* USER METHODS */

  /**
   * Fetches a list of all identity verifications performed on the user.
   * @returns {Object} A map of verification type to status.
   */
  async fetchVerifications() {
    const user = this.readAuthToken();
    return await this._sendGetRequest(
      `/applications/${this._opts.applicationId}/users/${
        user.userId
      }/verifications`
    );
  }

  /**
   * Gets the URI for token metadata.
   *
   * @param {Object} address The address of the token.
   * @param {Object} tokenId The id of the token.
   */
  getTokenURI({ address, tokenId }) {
    return;
    `${this.baseURL}/applications/${
      this._opts.applicationId
    }/tokens/${address}/${tokenId}/metadata`;
  }

  /* ANNOTATION METHODS */

  /**
   * Writes annotations for the current user.
   *
   * @param {Object} data
   * @param {Object} data.ethereum
   * @param {Object} data.ethereum.bytes32 Key-value mapping of bytes32 data to store on-chain. The key can be any string, and the value must be a hex-encoded string.
   * @param {Object} data.ethereum.bytes Key-value mapping of bytes data to store on-chain. The key can be any string, and the value must be a hex-encoded string.
   * @param {Object} data.private Key-value mapping of data to store off-chain.
   */
  async writeUserAnnotations(data) {
    const user = this.readAuthToken();
    return await this._sendPostRequest(
      `/applications/${this._opts.applicationId}/users/${
        user.userId
      }/annotations`,
      data
    );
  }

  /**
   * Fetches a list of all annotations on the user.
   */
  async fetchUserAnnotations() {
    const user = this.readAuthToken();
    return await this._sendGetRequest(
      `/applications/${this._opts.applicationId}/users/${
        user.userId
      }/annotations`
    );
  }

  /**
   * Writes annotations for a specific token.
   *
   * @param {Object} address The address of the token.
   * @param {Object} tokenId The id of the token.
   * @param {Object} data
   * @param {Object} data.ethereum
   * @param {Object} data.ethereum.bytes32 Key-value mapping of bytes32 data to store on-chain. The key can be any string, and the value must be a hex-encoded string.
   * @param {Object} data.ethereum.bytes Key-value mapping of bytes data to store on-chain. The key can be any string, and the value must be a hex-encoded string.
   * @param {Object} data.private Key-value mapping of data to store off-chain.
   */
  async writeTokenAnnotations({ address, tokenId, data }) {
    return await this._sendPostRequest(
      `/applications/${
        this._opts.applicationId
      }/tokens/${address}/${tokenId}/annotations`,
      data
    );
  }

  /**
   * Fetches a list of all annotations on a specific token.
   *
   * @param {Object} address The address of the token.
   * @param {Object} tokenId The id of the token.
   */
  async fetchTokenAnnotations({ address, tokenId }) {
    return await this._sendGetRequest(
      `/applications/${
        this._opts.applicationId
      }/tokens/${address}/${tokenId}/annotations`
    );
  }
}

export default Abacus;
