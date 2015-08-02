;(function ( $, window, document, undefined ) {
    var pluginName = "xtab",
        defaults = {
            data: [],
            dimensions: [],
            values: []
        };

    function XTab( element, options ) {
        this.element = element;

        this.options = $.extend( {}, defaults, options) ;

        this._defaults = defaults;
        this._name = pluginName;

        this.init();
    }

    var dragging;

    function getXtab(el) {
      return $(el).closest('.xtab').data("plugin_" + pluginName);
    }

    function dragStart(e) {
      console.log('dragstart: ' + e);
      dragging = e.target;
    }

    function canDrop(e) {
      var p = $(dragging).parent();

      return (($(p).hasClass('xtab-dims-list') && $(e.target).closest('.xtab-dims').length)
          || ($(p).hasClass('xtab-vals-list') && $(e.target).closest('.xtab-vals').length));
    }

    function dragOver(e) {
      if (canDrop(e)) {
        e.preventDefault();
      }
    }

    function drop(e) {
      var xtab = getXtab(e.target);
      var p = $(dragging).parent();

      if ($(p).hasClass('xtab-dims-list') && $(e.target).closest('.xtab-filters').length) {
        xtab.addFilter($(dragging).text());
      }
      //    || ($(p).hasClass('xtab-vals-list') && $(e.target).closest('.xtab-vals').length));


      dragging = null;
    }

    function removeFilter(e) {
      if ($(e.target).hasClass('fa-times-circle')) {
        var xtab = getXtab(e.target);
        var dim = $(e.target).closest('div').attr('name');

        xtab.removeFilter(dim);
      }
    }

    XTab.prototype = {
        init: function() {
          var xt = this;
          $(this.element).append('<div class="xtab-dims-list"><label>dimensions</label></div><div class="xtab-vals-list"><label>values</label></div>');
          $(this.element).append('<div class="xtab-filters xtab-dims"><label>filters</label></div>');
          $(this.element).append('<table class="xtab-data"><tbody><tr><td class="xtab-corner">&nbsp;</td><td class="xtab-dims xtab-h">&nbsp;</td></tr><tr><td class="xtab-dims xtab-v">&nbsp;</td><td class="xtab-vals">&nbsp;</td></tr></tbody></table>');

          $.each(this.options.dimensions, function () {
            $('.xtab-dims-list', xt.element).append('<div draggable="true">' + this + '</div>');
          });
          $.each(this.options.values, function () {
            $('.xtab-vals-list', xt.element).append('<div draggable="true">' + this + '</div>');
          });

          $(this.element).on('dragstart', dragStart);
          $(this.element).on('dragover', dragOver);
          $(this.element).on('drop', drop);

          $('.xtab-filters', this.element).click(removeFilter);

          this._filters = [];
          this._h_dims = [];
          this._v_dims = [];
          this._dimcache = {};
        },

        getDimValues: function(dim) {
          if (dim in this._dimcache) {
            return this._dimcache[dim];
          }

          var data = this.options.data;
          var dl = [];

          for (var i = 0; i < data.length; i++) {
            if (dl.indexOf(data[i][dim]) < 0) {
              dl.push(data[i][dim]);
            }
          }

          return this._dimcache[dim] = dl;
        },

        addFilter: function (dim) {
          if (this._filters.indexOf(dim) > -1) {
            return;
          }

          this._filters.push(dim);
          var fd = $('<div name="' + dim + '"><label><i class="fa fa-times-circle"></i>&nbsp;' + dim + '</label><div class="selstrip"></div>');
          $('.selstrip', fd).selStrip({values:this.getDimValues(dim)});

          $('.xtab-filters div').selStrip('readonly', true);
          $('.xtab-filters', this.element).append(fd);
        },

        removeFilter: function (dim) {
          var i = this._filters.indexOf(dim);

          if (i >= 0) {
            this._filters.splice(i, 1);
            $('.xtab-filters div[name=' + dim + ']', this.element).remove();
          }
        }
    };

    $.fn[pluginName] = function ( options ) {
        return this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName,
                new XTab( this, options ));
            }
        });
    };

})( jQuery, window, document );
