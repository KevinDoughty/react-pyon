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
  //var previousReactPyon = root.ReactPyon;

  var hasRequire = (typeof require !== "undefined");
  var RegularPyon = root.Pyon || hasRequire && require("pyon");
  if (!RegularPyon) throw new Error("React Pyon requires regular Pyon. If you are using script tags Pyon must come first.");
  var React = root.React || hasRequire && require("react");
  if (!React) throw new Error("React Pyon requires React. If you are using script tags React must come first.");
/*
  var InnerComponent = React.createClass({
    render: function() { }
  });
  
  var OuterComponent = hoc(DumbComponent, React.createClass({
    render: function() {
      return <DumbComponent />;
    }
  }))
*/

  //reactimate: (animationDict,OriginalComponent) => class extends Component {
  RegularPyon.reactify = function(animationDict, OriginalComponent) {
    var InnerComponent = OriginalComponent;
    if (isFunction(animationDict) && typeof OriginalComponent === "undefined") {
      InnerComponent = animationDict;
      animationDict = {};
    }
    var OuterComponentClass = React.createClass({
    
      displayName : "OuterComponent",

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
          animationForKey: this.animationForKey.bind(this),
          debugProps: component.props,
          render: function() {
            component.renderingPresentation = true; // TODO: this won't work because of React batching/ remove.
            shoeContext.beginTransaction({owner: component}); // FIXME: also has problem of React batching, but can also be overwritten by manually created transactions
            if (this.mounted) this.setState(layer); // FIXME: conditional should not be necessary
            shoeContext.commitTransaction();
          }.bind(this),
        }
        RegularPyon.Mixin(delegate,layer,delegate);
        this.getPresentationLayer = function() {
          return delegate.presentation;
          //return layer.presentation;
          //return shoeContext.presentationLayer(layer);
        }
        this.state = { wantsLayer: null, layer:layer };
      },
    
      shouldComponentUpdate: function(nextProps,nextState) {
        var result = true;
        var transaction = shoeContext.currentTransaction();
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
              var copy = animationFromDescription(animation); // I don't think it's a copy! Should be because you mutate it
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
        //const propValues = this.propValues(this.props);
        //var output = {...propValues, ...presentationLayer};
       
        //var propValues = this.propValues(this.props);
        //var output = Object.keys(propValues).reduce(function(n, k) { n[k] = propValues[k]; return n;}, {});
        //Object.keys(presentationLayer
        var modelLayer = this.layer;
        var propValues = Object.keys(modelLayer).reduce(function(a, b) { a[b] = modelLayer[b]; return a;}, {});
        var presentationLayer = this.delegate.presentation;
        var output = Object.keys(presentationLayer).reduce(function(a, b) { a[b] = presentationLayer[b]; return a;}, {});
        
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
        return InnerComponent(output);
        /*
        return <OriginalComponent
          {...output}
          modelProps={propValues}
          velvetProps={velvetProps}
          velvetDelegate={owner.delegate}
          addAnimation={owner.delegate.addAnimation.bind(owner.delegate)} // Can't wait for instance to set manually. Must use props.
          ref={ ref }
        />;
        */
      }
    }
    var OuterComponent = React.createFactory(OuterComponentClass); // extra step required because I'm not using JSX
    return OuterComponent;
  }
}).call(this);