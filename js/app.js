// import Router from "../node_modules/director/build/director.js"
// import {ko} from "../node_modules/knockout/build/output/knockout-latest.js"

const ENTER_KEY = 13;
const ESCAPE_KEY = 27;

// A factory function we can use to create binding handlers for specific
// keycodes.
function keyhandlerBindingFactory(keyCode) {
	return {
		init: function (element, valueAccessor, allBindingsAccessor, data, bindingContext) {

			// wrap the handler with a check for the enter key
			const wrappedHandler = function (data, event) {
				if (event.keyCode === keyCode) {
					valueAccessor().call(this, data, event);
				}
			};

			// create a valueAccessor with the options that we would want to pass to the event binding
			const newValueAccessor = function () {
				return {
					keyup: wrappedHandler
				};
			};

			// call the real event binding's init function
			ko.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data, bindingContext);
		}
	};
}

// a custom binding to handle the enter key
ko.bindingHandlers.enterKey = keyhandlerBindingFactory(ENTER_KEY);

// another custom binding, this time to handle the escape key
ko.bindingHandlers.escapeKey = keyhandlerBindingFactory(ESCAPE_KEY);

// wrapper to hasFocus that also selects text and applies focus async
ko.bindingHandlers.selectAndFocus = {
	init: function (element, valueAccessor, allBindingsAccessor, bindingContext) {
		ko.bindingHandlers.hasFocus.init(element, valueAccessor, allBindingsAccessor, bindingContext);
		ko.utils.registerEventHandler(element, 'focus', () => element.focus());
	},
	update: function (element, valueAccessor) {
		ko.utils.unwrapObservable(valueAccessor()); // for dependency
		// ensure that element is visible before trying to focus
		setTimeout(() => ko.bindingHandlers.hasFocus.update(element, valueAccessor), 0);
	}
};

// represent a single todo item
class Todo {
	constructor(title, completed) {
		this.title = ko.observable(title);
		this.completed = ko.observable(completed);
		this.editing = ko.observable(false);
	}
};

// our main view model
class ViewModel {
	constructor(todos) {
		// map array of passed in todos to an observableArray of Todo objects
		this.todos = ko.observableArray(todos.map((todo) => new Todo(todo.title, todo.completed)));

		// store the new todo value being entered
		this.current = ko.observable();

		this.showMode = ko.observable('all');

		this.filteredTodos = ko.computed(() => {
			switch (this.showMode()) {
			case 'active':
				return this.todos().filter((todo) => !todo.completed());
			case 'completed':
				return this.todos().filter((todo) => todo.completed());
			default:
				return this.todos();
			}
		});

		// count of all completed todos
		this.completedCount = ko.computed(() => 
			this.todos().filter((todo) => todo.completed()).length);
	
		// count of todos that are not complete
		this.remainingCount = ko.computed(() => 
			this.todos().length - this.completedCount());
	
		// writeable computed observable to handle marking all complete/incomplete
		this.allCompleted = ko.computed({
			//always return true/false based on the done flag of all todos
			read: () => !this.remainingCount(),
			// set all todos to the written value (true/false)
			write: (newValue) => {
				this.todos().forEach(function (todo) {
					// set even if value is the same, as subscribers are not notified in that case
					todo.completed(newValue);
				});
			}
		});

		// internal computed observable that fires whenever anything changes in our todos
		ko.computed(() => {
			// store a clean copy to local storage, which also creates a dependency on
			// the observableArray and all observables in each item
			localStorage.setItem('todos-knockoutjs', ko.toJSON(this.todos));
		}).extend({
			rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
		}); // save at most twice per second
	}

	// add a new todo, when enter key is pressed
	add() {
		let current = this.current().trim();
		if (current) {
			this.todos.push(new Todo(current));
			this.current('');
		}
	}

	// remove a single todo
	remove(todo) {
		this.todos.remove(todo);
	}

	// remove all completed todos
	removeCompleted() {
		this.todos.remove(function (todo) {
			return todo.completed();
		});
	}

	// edit an item
	editItem(item) {
		item.editing(true);
		item.previousTitle = item.title();
	}

	// stop editing an item.  Remove the item, if it is now empty
	saveEditing(item) {
		item.editing(false);

		let title = item.title();
		let trimmedTitle = title.trim();

		// Observable value changes are not triggered if they're consisting of whitespaces only
		// Therefore we've to compare untrimmed version with a trimmed one to chech whether anything changed
		// And if yes, we've to set the new value manually
		if (title !== trimmedTitle) {
			item.title(trimmedTitle);
		}

		if (!trimmedTitle) {
			this.remove(item);
		}
	}

	// cancel editing an item and revert to the previous content
	cancelEditing(item) {
		item.editing(false);
		item.title(item.previousTitle);
	}

	// helper function to keep expressions out of markup
	getLabel(count) {
		return ko.utils.unwrapObservable(count) === 1 ? 'item' : 'items';
	}
};

// check local storage for todos
let todos = ko.utils.parseJson(localStorage.getItem('todos-knockoutjs'));

// bind a new instance of our view model to the page
let viewModel = new ViewModel(todos || []);
ko.applyBindings(viewModel);

// set up filter routing
/*jshint newcap:false */
Router({ '/:filter': viewModel.showMode }).init();
