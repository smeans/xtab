;(function ( $, window, document, undefined ) {
    var pluginName = "xtab",
        defaults = {
            data: [],
            dimensions: [],
            values: []
        };

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
          || ($(p).hasClass('xtab-vals-list') && $(e.target).closest('.xtab-vals-scroll').length));
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

      if ($(p).hasClass('xtab-vals-list') && $(e.target).closest('.xtab-vals-scroll').length) {
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

    function nameToLabel(name) {
      return name == '' ? '(blank)' : name;
    }

    function scrollData(e) {
      var xtab = getXtab(e.target);
      var xd = $(e.target).closest('.xtab-data');
      var dx = $('.xtab-h', xd).scrollLeft();
      var dy = $('.xtab-v', xd).scrollTop();

      $('.xtab-vals', xd).css({top:-dy, left:-dx});
    }

    function dimLabelsFromTree(dt) {
      if (!dt) {
        return '';
      }

      var html = '';
      var isLeaf = true;

      $.each(dt, function () {
        html += '<li>';

        if (typeof this == 'string' || this instanceof String) {
          html += nameToLabel(this);
        } else {
          html += nameToLabel(this.name) + dimLabelsFromTree(this.children);
          isLeaf = false;
        }
      });

      if (isLeaf) {
        return '<ul class="xtab-leaf">' + html +'</ul>';
      } else {
        return '<ul>' + html + '</ul>';
      }
    }

    function countLeaves(dt) {
      var lc = 0;

      $.each(dt, function () {
        if (typeof this == 'string' || this instanceof String) {
          lc++;
        } else {
          lc += this.leafcount = countLeaves(this.children);
        }
      });

      return lc;
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
        if (cl) {
          dta.push({name:this, children:cl});
        } else {
          dta.push(this);
        }

      });

      return dta;
    }

    function buildDimTree(xtab, data, dims) {
      var dt = buildDTW(xtab, data, dims, 0, {});
      return dt ? dt : [];
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

    function XTabCalc(data, h_dims, hdt, v_dims, vdt, value) {
      this._data = data;
      this._h_dims = h_dims;
      this._hdt = hdt;
      this._v_dims = v_dims;
      this._vdt = vdt;
      this._value = value;
      this.cols = countLeaves(hdt);
      this.rows = countLeaves(vdt);
      var cb = this.cols * this.rows * 4;
      this.values = new Int32Array(new ArrayBuffer(cb));
    }

    XTabCalc.prototype = {
      recalc: function () {
        this.visitAll();
      },

      visitAll: function () {
        this._visitRow({}, this._data, this._vdt, 0, 0);
      },

      _visitRow: function (filter, data, dt, level, row) {
        var xtc = this;

        $.each(dt, function () {
          if (typeof this == 'string' || this instanceof String) {
            filter[xtc._v_dims[level]] = this;
            xtc._visitCols(filter, data.filterByObject(filter),
                xtc._hdt, 0, row, 0);
            delete filter[xtc._v_dims[level]];

            row++;
          } else {
            filter[xtc._v_dims[level]] = this.name;
            row = xtc._visitRow(filter, data.filterByObject(filter),
                this.children, level+1, row);
            delete filter[xtc._v_dims[level]];
          }
        });

        return row;
      },

      _visitCols: function (filter, data, dt, level, row, col) {
        var xtc = this;

        $.each(dt, function () {
          if (typeof this == 'string' || this instanceof String) {
            var dim = xtc._h_dims[level];
            var val = this;
            var ds = data.filter(function (el) {
              return !(dim in el) || el[dim] == val;
            });
            $.each(ds, function () {
              if (xtc._value in this) {
                xtc.values[row*xtc.cols + col] += parseInt(this[xtc._value]);
              }
            });
            col++;
          } else {
            filter[xtc._h_dims[level]] = this.name;
            col = xtc._visitCols(filter, data.filterByObject(filter),
                this.children, level+1, row, col);
            delete filter[xtc._h_dims[level]];
          }
        });

        return col;
      }
    };

    function XTab(element, options) {
        this.element = element;

        this.options = $.extend( {}, defaults, options) ;

        this._defaults = defaults;
        this._name = pluginName;

        this.init();
    }

    XTab.prototype = {
        init: function () {
          var xt = this;
          $(this.element).append('<div class="xtab-dims-list"><label>dimensions</label></div><div class="xtab-vals-list"><label>values</label></div>');
          $(this.element).append('<div class="xtab-filters"><label>filters</label></div>');
          $(this.element).append('<div class="xtab-message">&nbsp;</div>');
          $(this.element).append('<div class="xtab-data"><div class="xtab-data-top"><div class="xtab-corner"><button name="xtabReset">reset</button></div><div class="xtab-dims xtab-h">&nbsp;</div></div><div class="xtab-data-bottom"><div class="xtab-dims xtab-v">&nbsp;</div><div class="xtab-vals-scroll"><div class="xtab-vals">&nbsp;</div></div></div></div>');

          $.each(this.options.dimensions, function () {
            $('.xtab-dims-list', xt.element).append('<div draggable="true">' + this + '</div>');
          });
          $.each(this.options.values, function () {
            $('.xtab-vals-list', xt.element).append('<div draggable="true">' + this + '</div>');
          });

          $(this.element).on('dragstart', dragStart);
          $(this.element).on('dragover', dragOver);
          $(this.element).on('drop', drop);
          $('.xtab-data .xtab-dims', this.element).on('scroll', scrollData);
          $('button[name=xtabReset]', this.element).click(resetXtab);

          $('.xtab-filters', this.element).click(removeFilter);
          $('.xtab-filters', this.element).change(refreshData);

          this.reset();
        },

        reset: function () {
          this._filters = [];
          this._h_dims = [];
          this._v_dims = [];
          delete this._value
          delete this._xc;

          this.clearMessage();

          $('.xtab-filters div', this.element).remove();
          this.refreshData();
        },

        getFilteredData: function () {
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

          dl.sort();

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
          if (this._refreshing) {
            return;
          }
          this._refreshing = true;

          this.setMessage('recalculating...');
          var data = this.getFilteredData();

          this._hdt = buildDimTree(this, data, this._h_dims);
          $('.xtab-dims.xtab-h', this.element).html(dimLabelsFromTree(this._hdt));

          this._vdt = buildDimTree(this, data, this._v_dims);
          $('.xtab-dims.xtab-v', this.element).html(dimLabelsFromTree(this._vdt));

          $('.xtab-vals', this.element).empty();

          if (!this._hdt.length || !this._vdt.length) {
            $('.xtab-vals').html('<i>' + (this._value ? this._value : '&nbsp') + '</i>');
            this.clearMessage();
            this._refreshing = false;
            return;
          }

          if (!this._value) {
            this.clearMessage();
            this._refreshing = false;
            return;
          }

          var xc = this._xc = new XTabCalc(this.getFilteredData(), this._h_dims, this._hdt,
              this._v_dims, this._vdt, this._value);

          xc.recalc();

          var cla = $('.xtab-dims.xtab-h .xtab-leaf li');
          var cxp = $(cla[0]).closest('.xtab-dims').offset().left;
          var coa = [];
          var cow = []
          $.each(cla, function () {
            coa.push($(this).offset().left-cxp);
            cow.push($(this).width());
          });

          var rla = $('.xtab-dims.xtab-v .xtab-leaf li');
          var ryp = $(rla[0]).closest('.xtab-dims').offset().top;
          var ry = $(rla[0]).offset().top-ryp;
          var dy = $(rla[0]).height();

          for (var row = 0; row < xc.rows; row++) {
            for (var col = 0; col < xc.cols; col++) {
              var v = xc.values[row * xc.cols + col];
              if (v) {
                var html = '<div>' + v + '</div>';
                var css= {
                  top: dy * row + ry,
                  left: coa[col],
                  width: cow[col]
                };
                $(html).css(css).appendTo('.xtab-vals', this.element);
              }
            }
          }

          $('.xtab-vals', this.element).width(coa[xc.cols-1]+cow[xc.cols-1])
              .height(dy*xc.rows);


          this.clearMessage();
          this._refreshing = false;
        },

        setMessage: function (msg) {
          $('.xtab-message', this.element).text(msg);
        },

        clearMessage: function () {
          $('.xtab-message', this.element).text('');
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
