/*
Copyright (c) 2016 Kevin Doughty

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
"use strict";
;(function() {

  var root = this;
  var previousPyon = root.ReactPyon;
  var hasRequire = (typeof require !== "undefined");
  
  var React = root.React || hasRequire && require("react");
  if (typeof React === "undefined") throw new Error("React Pyon requires React. If you are using script tags React must come first.");

  var Pyon = root.Pyon || hasRequire && require("pyon");
  if (typeof Pyon === "undefined") throw new Error("React Pyon requires regular Pyon. If you are using script tags Pyon must come first.");

  function isFunction(w) {
    return w && {}.toString.call(w) === "[object Function]";
  }

  var ReactPyon = root.ReactPyon = {};
  ReactPyon.reactify = function(animationDict, OriginalComponent) {
    var InnerComponent = OriginalComponent;
    if (isFunction(animationDict) && typeof OriginalComponent === "undefined") {
      InnerComponent = animationDict;
      animationDict = {};
    }
    var OuterComponentClass = React.createClass({

      displayName : "PyonComponent",

      getInitialState : function() {
          return {}
      },

      initialize: function() {
        this.instance = null;
        this.mounted = false;
        this.renderingPresentation = false;
        var component = this;
        var layer = this.layer = {};
        var delegate = this.delegate = {
          animationForKey: this.animationForKey, // Do not need to bind (ES5 only?)
          debugProps: component.props,
          render: function() {
            component.renderingPresentation = true; // TODO: this won't work because of React batching/ remove.
            Pyon.beginTransaction({owner: component}); // FIXME: also has problem of React batching, but can also be overwritten by manually created transactions
            if (this.mounted) this.setState(layer); // FIXME: conditional should not be necessary
            Pyon.commitTransaction();
          }.bind(this),
        }
        Pyon.mixin(delegate,layer,delegate);
        this.getPresentationLayer = function() {
          return delegate.presentation;
        }
        this.state = { wantsLayer: null, layer:layer };
      },

      shouldComponentUpdate: function(nextProps,nextState) {
        var result = true;
        var transaction = Pyon.currentTransaction();
        var settings = null;
        if (transaction) settings = transaction.settings;
        if (settings && settings.owner && settings.owner !== this) result = false;
        return result;
      },
      animationForKey: function(key,value) {
        var animation = null;
        var instance = this.instance;
        if (instance && isFunction(instance.animationForKey)) animation = instance.animationForKey(key,value);
        return animation;
      },
      propValues: function(props) {
        var values = {};
        Object.keys(props).forEach( function(key) {
          var prop = props[key];
          var value = prop;
          var isObject = (prop !== null && typeof prop === "object");
          if (isObject && typeof prop.value !== "undefined") value = prop.value;
          values[key] = value;
        });
        return values;
      },
      processProps: function(props) {
        this.renderingPresentation = false; // TODO: remove this
        var layer = this.layer;
        Object.keys(props).forEach( function(key) {
          var animation = animationDict[key];
          var prop = props[key];
          var value = prop;
          var isObject = (prop !== null && typeof prop === "object");
          if (isObject && typeof prop.value !== "undefined") { // detect if a change description
            value = prop.value;
            animation = prop.transition;
          }
          var oldProp = this.props[key];
          var oldValue = oldProp;
          var isObjectOld = (oldProp !== null && typeof oldProp === "object");
          if (isObjectOld && typeof oldProp.value !== "undefined") oldValue = oldProp.value;
          //var sort;
          //if (animation) sort = animation.sort;
          //if (typeof layer[key] === "undefined" || (sort && !sort(value,oldValue)) || (!sort && value !== oldValue)) {
            layer[key] = value;
          //}
        }.bind(this));
      },
      registerProps: function(props) {
        Object.keys(props).forEach( function(key) {
          var animation = animationDict[key];
          var prop = props[key];
          var value = prop;
          var isObject = (prop !== null && typeof prop === "object");
          if (isObject && typeof prop.value !== "undefined") {
            value = prop.value;
            animation = prop.transition;
          }
          this.delegate.registerAnimatableProperty(key,animation);
        }.bind(this));
      },
      componentWillReceiveProps: function(props) {
        if (!this.mounted) throw new Error("GET THE HELL OUT OF HERE WITH YOUR BEING NOT MOUNTED");
        var layer = this.layer;
        var mixin = this.delegate;
        this.processProps(props);
      },
      componentWillMount: function() {
        this.initialize();
        this.processProps(this.props);
        this.registerProps(this.props); // this is awkward registering after processing but otherwise animations trigger before all props have been applied, get nulls for some values
        Object.keys(this.props).forEach( function(key) { // have to manually trigger mount animation
          var animation = animationDict[key];
          var prop = this.props[key];
          var value = prop;
          var isObject = (prop !== null && typeof prop === "object");
          if (isObject && typeof prop.value !== "undefined") {
            value = prop.value;
            animation = prop.mount;
            if (animation) {
              var copy = Object.keys(animation).reduce(function(a, b) { a[b] = animation[b]; return a;}, {});
              if (copy) {
                copy.property = key;
                this.delegate.addAnimation(copy);
              }
            }
          }
        }.bind(this));
      },
      componentWillUnmount: function() {
        this.mounted = false;
      },
      componentDidMount: function() {
        this.mounted = true;
      },
      render: function() {
        var presentationLayer = this.delegate.presentation;
        var propValues = this.propValues(this.props);
        var modelLayer = this.layer;
        var presentationLayer = this.delegate.presentation;
        var output = this.propValues(this.props);
        Object.keys(presentationLayer).forEach( function(key) {
          output[key] = presentationLayer[key];
        });
        
        var owner = this;
        var ref;
        if (!this.renderingPresentation) ref = function(component) {
          if (component && owner.instance !== component) {
            owner.instance = component;
            component.layer = owner.layer; // TODO: remove this
          }
        }
        var velvetProps = {renderingPresentation:this.renderingPresentation};

        output.modelProps = propValues;
        output.velvetProps = velvetProps;
        output.velvetDelegate = owner.delegate;
        output.addAnimation = owner.delegate.addAnimation.bind(owner.delegate);
        output.ref = ref;
        
        return React.createElement(InnerComponent,output,null,ref);
      }
    });
    //return OuterComponentClass;
    var OuterComponent = React.createFactory(OuterComponentClass);
    return OuterComponent;
  }
  
  ReactPyon.noConflict = function() {
    root.ReactPyon = previousReactPyon;
    return ReactPyon;
  }
  if (typeof exports !== "undefined") { // http://www.richardrodger.com/2013/09/27/how-to-make-simple-node-js-modules-work-in-the-browser/#.VpuIsTZh2Rs
    if (typeof module !== "undefined" && module.exports) exports = module.exports = ReactPyon;
    exports.ReactPyon = ReactPyon;
  } else root.ReactPyon = ReactPyon;
  
  //if (typeof module !== "undefined" && typeof module.exports !== "undefined") module.exports = ReactPyon; // http://www.matteoagosti.com/blog/2013/02/24/writing-javascript-modules-for-both-browser-and-node/
  //else window.ReactPyon = ReactPyon;

}).call(this);
