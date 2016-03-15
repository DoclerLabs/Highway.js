/**
 * Delimiter to split event routes
 * @type {string}
 */
const DELIMITER = '->'

/**
 * Default bucket prototype
 * @type {{*: {handlers: Array}}}
 */
const DEFAULT_BUCKET = {
	'*': {
		handlers: []
	}
}

/**
 * 'exe' method event name
 * @type {String}
 */
const EV_EXECUTE = 'HWEXECUTE'

/**
 * Main Highway JS class
 */
export default class Highway {

	/**
	 * Host object
	 * @static
	 */
	Host

	/**
	 * Bucket to store handlers
	 * @type {{*: {handlers: Array}}}
	 */
	Bucket

	/**
	 * @constructor
	 * @param Host {Window || Worker}
	 */
	constructor(Host = self) {
		this.Host   = Host
		this.reset()
		this._bind()
	}

	/**
	 * Publish an event
	 * @param name  {String} The event's name
	 * @param data  [Mixed]  Custom event data
	 * @param state [String] Optional state identifier
	 * @returns {Highway}
	 */
	pub(name, data = undefined, state = undefined) {
		this.Host.postMessage(
			{name, data, state},
			this.Host === self.window ? self.location.origin : undefined
		)
		return this
	}

	/**
	 * Subscribe to an event
	 * @param name    {String}   The event's name
	 * @param handler {Function} Callback function
	 * @param one     {Boolean}  Run once, then off?
	 * @returns {Highway}
	 */
	sub(name, handler, one = false) {
		// Apply one prop
		handler.one = one

		// Apply segments and prototype
		let temp = this.Bucket
		name.split(DELIMITER).forEach((k, i, a) => {
			if (!temp.hasOwnProperty(k)) {
				temp[k] = {
					handlers: []
				}
			}
			temp = temp[k];
			++i === a.length && temp.handlers.push(handler)
		})

		// Make it chainable
		return this
	}

	/**
	 * Shorthand to subscribe once
	 * @param   ...a = this.sub args
	 * @returns {Highway}
	 */
	one(...a){
		this.sub(...a, true)
		return this
	}

	/**
	 * Unsubscribe from an event
	 * @param   name      {String} Name of the event
	 * @param   handler   {Function|undefined|Boolean} Handler to remove | Remove all for this event name | true: Deep remove
	 * @returns {Highway}
	 */
	off(name, handler = undefined) {
		let temp = this.Bucket

		name.split(DELIMITER).forEach((k, i, a) => {
			if (temp.hasOwnProperty(k)) {
				if (handler === true && k === a[a.length-1]) {
					delete temp[k]
				}
				else {
					temp = temp[k];
					temp.handlers = temp.handlers.filter((fn) => {
						return !(fn === handler || handler === undefined)
					})
				}
			}
		})
		return this
	}

	/**
	 * Execute a function on the other side.
	 * @param fn {Function} The function to execute.
	 */
	exe(fn){
		this.pub(EV_EXECUTE, fn.toString().match(/function[^{]+\{([\s\S]*)}$/)[1])
	}

	/**
	 * Destroy the full Highway instance
	 */
	destroy() {
		this.Host.removeEventListener('message', ::this._handler)
		delete this.Bucket
	}

	/**
	 * Resets Bucket to default
	 */
	reset(){
		DEFAULT_BUCKET['*'].handlers = []
		this.Bucket = Object.assign({}, DEFAULT_BUCKET)
	}

	/**
	 * Add message listener to the host
	 * @private
	 */
	_bind() {
		this.Host.addEventListener('message', ::this._handler)
		this.sub(EV_EXECUTE, function(ev){
			(new Function(ev.data)).call(self)
		})
	}

	/**
	 * onMessage callback handler
	 * @param ev {WorkerEvent}
	 * @private
	 */
	_handler(ev) {
		let parsed = this.Bucket
		let nope = false

		parsed['*'].handlers.forEach((fn) => fn.call(null, ev.data))
		ev.data.name.split(DELIMITER).forEach((segment) => {
			if (!nope && parsed.hasOwnProperty(segment)) {
				parsed = parsed[segment]

				parsed.handlers.length
				&& parsed.handlers.forEach((fn, i, arr) => {
					fn.call(null, ev.data)
					fn.one && arr.splice(i, 1)
				})
			}
			else {
				nope = true
			}
		})
	}
}

// Make Highway globally available
self.Highway = Highway