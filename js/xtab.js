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
      dragging = e.target;
    }

    function canDrop(e) {
      var p = $(dragging).parent();

      return (($(p).hasClass('xtab-dims-list') && $(e.target).closest('.xtab-dims, .xtab-filters').length)
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

      if ($(p).hasClass('xtab-dims-list') && $(e.target).closest('.xtab-dims.xtab-h').length) {
        xtab.addHDim($(dragging).text());
      }

      if ($(p).hasClass('xtab-dims-list') && $(e.target).closest('.xtab-dims.xtab-v').length) {
        xtab.addVDim($(dragging).text());
      }

      if ($(p).hasClass('xtab-vals-list') && $(e.target).closest('.xtab-vals').length) {
        xtab.setValue($(dragging).text());
      }


      dragging = null;
    }

    function removeFilter(e) {
      if ($(e.target).hasClass('fa-times-circle')) {
        var xtab = getXtab(e.target);
        var dim = $(e.target).closest('div').attr('name');

        xtab.removeFilter(dim);
      }
    }

    function refreshData(e) {
      getXtab(e.target).refreshData();
    }

    function resetXtab(e) {
      var xtab = getXtab(e.target);

      xtab.reset();
      xtab.refreshData();
    }

    function buildDLL(xtab, data, dims, level, filter) {
      if (level >= dims.length) {
        return null;
      }

      var dl = xtab.getDimValues(dims[level], data);
      dl.sort();
      var html = '';

      $.each(dl, function () {
        html += '<li>' + this


        filter[dims[level]] = this;
        var cl = buildDLL(xtab, data.filterByObject(filter), dims, level+1, filter);
        delete filter[dims[level]];

        if (cl) {
          html += '<ul>' + cl + "</ul>";
        }
        html += '</li>'
      });

      return html;
    }

    function buildDimLabels(xtab, data, dims) {
      var dlr = $('<ul></ul>');

      var dll = buildDLL(xtab, data, dims, 0, {});
      if (dll) {
        $(dlr).append(dll);
      }

      return dlr;
    }

    function buildDTW(xtab, data, dims, level, filter) {
      if (level >= dims.length) {
        return null;
      }

      var dta = [];
      var dl = xtab.getDimValues(dims[level], data);
      dl.sort();

      $.each(dl, function () {
        filter[dims[level]] = this;
        var cl = buildDTW(xtab, data.filterByObject(filter), dims, level+1, filter);
        delete filter[dims[level]];
        dta.push({name:this, children:cl});
      });

      return dta;
    }

    function buildDimTree(xtab, data, dims) {
      return buildDTW(xtab, data, dims, 0, {});
    }

    Array.prototype.filterByObject = function (o) {
      return this.filter(function (el) {
        for (var k in o) {
          if (o.hasOwnProperty(k) && k in el) {
            if (Array.isArray(o[k])) {
              if (o[k].indexOf(el[k]) < 0) {
                return false;
              }
            } else if (o[k] != el[k]) {
              return false;
            }
          }
        }

        return true;
      });
    }

    XTab.prototype = {
        init: function() {
          var xt = this;
          $(this.element).append('<div class="xtab-dims-list"><label>dimensions</label></div><div class="xtab-vals-list"><label>values</label></div>');
          $(this.element).append('<div class="xtab-filters"><label>filters</label></div>');
          $(this.element).append('<table class="xtab-data"><tbody><tr><td class="xtab-corner"><button name="xtabReset">reset</button></td><td class="xtab-dims xtab-h">&nbsp;</td></tr><tr><td class="xtab-dims xtab-v">&nbsp;</td><td class="xtab-vals">&nbsp;</td></tr></tbody></table>');

          $.each(this.options.dimensions, function () {
            $('.xtab-dims-list', xt.element).append('<div draggable="true">' + this + '</div>');
          });
          $.each(this.options.values, function () {
            $('.xtab-vals-list', xt.element).append('<div draggable="true">' + this + '</div>');
          });

          $(this.element).on('dragstart', dragStart);
          $(this.element).on('dragover', dragOver);
          $(this.element).on('drop', drop);
          $('button[name=xtabReset]', this.element).click(resetXtab);

          $('.xtab-filters', this.element).click(removeFilter);
          $('.xtab-filters', this.element).change(refreshData);

          this.reset();
        },

        reset: function () {
          this._filters = [];
          this._h_dims = [];
          this._v_dims = [];

          $('.xtab-filters div', this.element).remove();
          this.refreshData();
        },

        getFilteredData: function() {
          var data = this.options.data;
          var fvd = {};
          $('.xtab-filters div', this.element).each(function () {
            var dim = $(this).attr('name');
            fvd[dim] = $('.selstrip', this).selStrip('values');
          });

          return data.filterByObject(fvd);
        },

        getDimValues: function (dim, data) {
          if (!data) {
            data = this.getFilteredData();
          }
          var dl = [];

          for (var i = 0; i < data.length; i++) {
            if (dl.indexOf(data[i][dim]) < 0) {
              dl.push(data[i][dim]);
            }
          }

          return dl;
        },

        getFilteredDimValues: function (dim) {
          var fss = $('.xtab-filters div[name=' + dim +'] .selstrip');
          if (fss.length > 0) {
            return $(fss).selStrip('values');
          }

          return this.getDimValues(dim);
        },

        addFilter: function (dim) {
          if (this._filters.indexOf(dim) > -1) {
            return;
          }

          this._filters.push(dim);
          var fd = $('<div name="' + dim + '"><label><i class="fa fa-times-circle"></i>&nbsp;' + dim + '</label><div class="selstrip"></div>');
          $('.selstrip', fd).selStrip({values:this.getDimValues(dim)});

          $('.xtab-filters div', this.element).selStrip('readonly', true);
          $('.xtab-filters', this.element).append(fd);

          this.refreshData();
        },

        removeFilter: function (dim) {
          var i = this._filters.indexOf(dim);

          if (i >= 0) {
            this._filters.splice(i, 1);
            $('.xtab-filters div[name=' + dim + ']', this.element).remove();
          }

          this.refreshData();
        },

        isActiveDim: function (dim) {
          return this._h_dims.indexOf(dim) > -1 || this._v_dims.indexOf(dim) > -1;
        },

        addHDim: function (dim) {
          if (this.isActiveDim(dim)) {
            return;
          }

          this._h_dims.push(dim);

          this.refreshData();
        },

        addVDim: function (dim) {
          if (this.isActiveDim(dim)) {
            return;
          }

          this._v_dims.push(dim);

          this.refreshData();
        },

        setValue: function (val) {
          this._value = val;

          this.refreshData();
        },

        refreshData: function () {
          var data = this.getFilteredData();

          var hdt = buildDimTree(this, data, this._h_dims);
          console.log(hdt);

          var hdl = buildDimLabels(this, data, this._h_dims);
          $('.xtab-dims.xtab-h', this.element).html(hdl);

          var vdl = buildDimLabels(this, data, this._v_dims);
          $('.xtab-dims.xtab-v', this.element).html(vdl);
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
