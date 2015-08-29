;(function ( $, window, document, undefined ) {
    var pluginName = "xtab",
        defaults = {
            data: [],
            dimensions: [],
            values: [],
            hideZeros: true,
            dimZeros: false,
            showGrid: false
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
        xtab.addValue($(dragging).text());
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

    function valClicked(e) {
      var xtab = getXtab(e.target);

      var vc = $(e.target).data('coords');
      if (vc) {
        console.log(vc[0] + ', ' + vc[1] + '(' + vc[2] + ') clicked');
        hf = filtersForLeaf(xtab._h_dims, xtab._hdt, vc[0]);
        vf = filtersForLeaf(xtab._v_dims, xtab._vdt, vc[1]);

        console.log(hf);
        console.log(vf);
      }
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

    function valLabels(values) {
      html = '<ul class="xtab-leaf xtab-val-leaf">';
      $.each(values, function () {
         html += '<li>' + nameToLabel(this) + '</li>';
      });

      html += '</ul>';

      return html;
    }

    function dimLabelsFromTree(dt, values) {
      if (!dt) {
        return '';
      }

      var html = '';
      var isLeaf = true;

      $.each(dt, function () {
        html += '<li>';

        if (typeof this == 'string' || this instanceof String) {
          if (!values || values.length <= 1) {
            html += nameToLabel(this);
          } else {
            html += nameToLabel(this) + valLabels(values);
            isLeaf = false;
          }
        } else {
          html += nameToLabel(this.name) + dimLabelsFromTree(this.children, values);
          isLeaf = false;
        }
      });

      if (isLeaf) {
        return '<ul class="xtab-leaf">' + html +'</ul>';
      } else {
        return '<ul>' + html + '</ul>';
      }
    }

    function filtersForLeaf(dims, dt, li) {
      var lc = 0;
      var fd = {};

      function fflw(dl, dim) {
        for (var i = 0; i < dl.length; i++) {
          if (typeof dl[i] == 'string' || dl[i] instanceof String) {
            if (lc == li) {
              fd[dims[dim]] = dl[i];

              return true;
            }
            lc++;
          } else {
            if (fflw(dl[i].children, dim + 1)) {
              fd[dims[dim]] = dl[i].name;

              return true
            };
          }
        }

        return false;
      }

      fflw(dt, 0);

      return fd;
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

    function repeatString(pattern, count) {
        if (count < 1) return '';
        var result = '';
        while (count > 1) {
            if (count & 1) result += pattern;
            count >>= 1, pattern += pattern;
        }
        return result + pattern;
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
      this.vals = this._value.length;
      var cb = this.cols * this.rows * this.vals * 4;
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
              for (var i = 0; i < xtc.vals; i++) {
                var vn = xtc._value[i];

                if (vn in this) {
                  xtc.values[row*xtc.cols*xtc.vals + col*xtc.vals+i] += parseInt(this[vn]);
                }
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
      },

      exportCsv: function () {
        var xtc = this;

        var hd = this._h_dims;
        var vd = this._v_dims;
        var v = this._value;

        var ha = [];
        for (var i = 0; i < hd.length; i++) {
          ha.push(repeatString('\t', vd.length-1));
        }

        function exportHDim(dt, level) {
          var cc = 0;

          $.each(dt, function () {
            if (typeof this == 'string' || this instanceof String) {
              ha[level] += '\t' + this;
              cc++;
            } else {
              ha[level] += '\t' + this.name;
              var scc = exportHDim(this.children, level+1);
              ha[level] += repeatString('\t', scc-1);
              cc += scc;
            }
          });

          return cc;
        }

        exportHDim(this._hdt, 0);

        var row = 0;

        function exportVDim(dt, level, prefix) {
          $.each(dt, function () {
            if (typeof this == 'string' || this instanceof String) {
              var vc = xtc._value.length;
              var si = xtc.cols * vc * row;
              var rs = prefix + '\t="' + this + '"';
              for (var i = 0; i < xtc.cols * vc; i++) {
                rs += '\t' + xtc.values[si + i];
              }

              ha.push(rs);
              row += 1;
              // !!!LATER!!! values go here
            } else {
              exportVDim(this.children, level+1, prefix + (prefix == '' ? '="' + this.name + '"' : '\t' + '="' + this.name + '"'));
            }
          });
        }

        exportVDim(this._vdt, 0, '');

        return ha.join('\n');
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
          $(this.element).append('<div class="xtab-data"><div class="xtab-data-top"><div class="xtab-corner"></div><div class="xtab-dims xtab-h">&nbsp;</div></div><div class="xtab-data-bottom"><div class="xtab-dims xtab-v">&nbsp;</div><div class="xtab-vals-scroll"><div class="xtab-vals">&nbsp;</div></div></div></div>');

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
          $('.xtab-vals').click(valClicked);

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

        save: function () {
          var fa = [];

          $('.xtab-filters div[name]', this.element).each(function () {
            var dim = $(this).attr('name');
            fa.push({name: dim, values:$('.selstrip', this).selStrip('values')});
          });
          return {filters:fa, h_dims: this._h_dims, v_dims:this._v_dims,
            value: this._value};
        },

        saveCallback: function (callback) {
          callback(this.save());
        },

        load: function (sd) {
          this.reset();

          var xtab = this;

          for (var i = 0; i < sd.filters.length; i++) {
            var f = sd.filters[i];

            xtab.addFilter(f.name, f.values);
          }

          $.each(sd.h_dims, function () {
            xtab.addHDim(this);
          });

          $.each(sd.v_dims, function () {
            xtab.addVDim(this);
          });

          $.each(sd.value, function () {
            xtab.addValue(this);
          });

          xtab.refreshData();
        },

        getFilteredData: function () {
          var data = this.options.data;
          var fvd = {};
          $('.xtab-filters div[name]', this.element).each(function () {
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

        addFilter: function (dim, selected) {
          if (this._filters.indexOf(dim) > -1) {
            return;
          }

          this._filters.push(dim);
          var fd = $('<div name="' + dim + '"><label><i class="fa fa-times-circle"></i>&nbsp;' + dim + '</label><div class="selstrip"></div>');
          $('.selstrip', fd).selStrip({values:this.getDimValues(dim), selected:selected});

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

        addValue: function (val) {
          if (this._value) {
            if (this._value.indexOf(val) < 0) {
              this._value.push(val);
            }
          } else {
            this._value = [val];
          }

          this.refreshData();
        },

        exportCsv: function (callback) {
          if (!this._xc || !callback) {
            return;
          }

          var css = '';

          $('.xtab-filters div[name]', this.element).each(function () {
            if (css == '') {
              css = 'filters\n';
            }
            var dim = $(this).attr('name');
            css += dim + ':\t' + $('.selstrip', this).selStrip('values').join('\t') + '\n';
          });

          if (css != '') {
            css += '\ndata\n';
          }

          css += this._xc.exportCsv();

          callback(css);
        },

        refreshData: function () {
          if (this._refreshing) {
            return;
          }
          this._refreshing = true;

          var xtab = this;
          setTimeout(function () { xtab.refreshWorker() }, 1);
        },

        refreshWorker: function () {
          this.setMessage('recalculating...');
          var data = this.getFilteredData();

          this._hdt = buildDimTree(this, data, this._h_dims);
          $('.xtab-dims.xtab-h', this.element).html(dimLabelsFromTree(this._hdt, this._value));

          this._vdt = buildDimTree(this, data, this._v_dims);
          $('.xtab-dims.xtab-v', this.element).html(dimLabelsFromTree(this._vdt));

          $('.xtab-vals', this.element).empty();

          if (!this._hdt.length || !this._vdt.length) {
            $('.xtab-vals').html('<i>' + (this._value ? this._value.join() : '&nbsp') + '</i>');
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
          var roa = [];
          var roh = [];
          $.each(rla, function () {
            roa.push($(this).offset().top-ryp);
            roh.push($(this).height());
          });

          var tdx = coa[coa.length-1]+cow[cow.length-1];
          var tdy = roa[roa.length-1]+roh[roh.length-1];

          var lastParentNode;
          var grc;

          for (var row = 0; row < xc.rows; row++, grc++) {
            if (rla[row].parentNode != lastParentNode) {
              grc = 0;
              lastParentNode = rla[row].parentNode;
            }

            if (this.options.showGrid && grc % 2) {
              var html = '<div class="xtab-grid">&nbsp;</div>';
              var css = {
                top: roa[row],
                left: 0,
                width: tdx,
                height: roh[row]
              };
              $(html).css(css).appendTo('.xtab-vals', this.element);
            }
            for (var col = 0; col < xc.cols; col++) {
              for (var val = 0; val < xc.vals; val++) {
                var v = xc.values[row * xc.cols * xc.vals + (col * xc.vals + val)];

                if (this.options.hideZeros && !v) {
                  continue;
                }

                var html = '<div>' + v + '</div>';
                var css = {
                  top: roa[row],
                  left: coa[col * xc.vals + val],
                  width: cow[col * xc.vals + val]
                };
                if (!v && this.options.dimZeros) {
                  css['opacity'] = .7;
                }
                $(html).data('coords', [col, row, xc._value[val]]).css(css).appendTo('.xtab-vals', this.element);
              }
            }
          }

          $('.xtab-vals', this.element).width(tdx).height(tdy);


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

    $.fn[pluginName] = function ( methodOrOptions ) {
        var methods = XTab.prototype;
        var args = arguments;

        return this.each(function () {
          if ( methods[methodOrOptions] ) {
              var xtab = getXtab(this);
              return methods[methodOrOptions].apply( xtab, Array.prototype.slice.call( args, 1 ));
          } else if ( typeof methodOrOptions === 'object' || ! methodOrOptions ) {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName,
                new XTab( this, methodOrOptions ));
            }
          } else {
              $.error( 'Method ' +  methodOrOptions + ' does not exist on jQuery.tooltip' );
          }
        });
    };

})( jQuery, window, document );
