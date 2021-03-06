// This file is part of DQX - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License.
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

define(["jquery", "DQX/DocEl", "DQX/base64"],
    function ($, DocEl, Base64) {

        var SQL = {};


        //////////////////////////////////////////////////////////////////////////////////////
        // Encapsulates information about an SQL table column
        //////////////////////////////////////////////////////////////////////////////////////

        SQL.DataTypes = ['String', 'Float', 'Integer', 'MultiChoiceInt'];

        SQL.TableColInfo = function (iID, iname, idatatype, ichoicelist) {
            var that = {};
            that.ID = iID;
            that.name = iname;
            that.datatype = idatatype;
            that.choicelist = ichoicelist;

            //Converts a column content value to a display string
            that.content2Display = function(vl) {
                return vl.toString();
            }

            //Converts a display string to a column content value
            that.display2Content = function(str) {
                return str;
            }

            //returns true if this column is of numerical type
            that.isNumerical = function () {
                return (this.datatype == "Float") || (this.datatype == "Integer");
            }

            //returns true of this column contains multiple choice values
            that.isMultipleCoice = function () {
                return (this.datatype == "MultiChoiceInt") || ( this.choicelist && (this.choicelist.length>0) );
            }
            return that;
        }


        //////////////////////////////////////////////////////////////////////////////////////
        // A set of component classes that can be used to build an sql single table where clause
        // and encode it to an url-friendly string
        //////////////////////////////////////////////////////////////////////////////////////

        SQL.WhereClause = {};

        SQL.WhereClause.whcClassGenerator = {};

        //A list of all comparison operators that act on a field
        SQL.WhereClause._fieldComparisonOperators = [
            { ID: '=', name: 'Equals',
                String: true, Float: true, Integer: true, MultiChoiceInt: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', '=', '') }
            },
            { ID: '<>', name: 'Differs from',
                String: true, Float: true, Integer: true, MultiChoiceInt: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', '<>', '') }
            },
            { ID: '<', name: '<',
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', '<', '') }
            },
            { ID: '>', name: '>',
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', '>', '') }
            },
            { ID: '<=', name: '<=',
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', '<=', '') }
            },
            { ID: '>=', name: '>=',
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', '>=', '') }
            },
            { ID: 'between', name: 'Between',
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareBetween('', '', '') }
            },
            { ID: 'CONTAINS', name: 'Contains',
                String: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', 'CONTAINS', '') }
            },
            { ID: 'NOTCONTAINS', name: 'Does not contain',
                String: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', 'NOTCONTAINS', '') }
            },
            { ID: 'STARTSWITH', name: 'Starts with',
                String: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', 'STARTSWITH', '') }
            },
            { ID: 'LIKE', name: 'Like',
                String: true,
                Create: function () { return SQL.WhereClause.CompareFixed('', 'LIKE', '') }
            },
            { ID: 'ISPRESENT', name: 'Is present', MultiChoiceInt: true,
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.IsPresent() }
            },
            { ID: 'ISABSENT', name: 'Is absent', MultiChoiceInt: true,
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.IsAbsent() }
            },
            { ID: 'ISNOTEMPTYSTR', name: 'Is present', String: true,
                Create: function () { return SQL.WhereClause.IsNotEmptyStr() }
            },
            { ID: 'ISEMPTYSTR', name: 'Is absent', String: true,
                Create: function () { return SQL.WhereClause.IsEmptyStr() }
            },
            { ID: '=FIELD', name: 'Equals field', MultiChoiceInt: true, //test the equality with another database field
                String: true, Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.EqualsField() }
            },
            { ID: '<>FIELD', name: 'Differs from field', MultiChoiceInt: true, //test the difference with another database field
                String: true, Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.DiffersField() }
            },
            { ID: '<FIELD', name: '< Field', //Performs a < operation with a linear function of another field
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareField('<FIELD') }
            },
            { ID: '>FIELD', name: '> Field', //Performs a > operation with a linear function of another field
                Float: true, Integer: true,
                Create: function () { return SQL.WhereClause.CompareField('>FIELD') }
            },
            { ID: '_subset_', name: 'in subset',
                Create: function () { return SQL.WhereClause.InSubset() }
            },
            { ID: '_note_', name: 'has note containing',
                Create: function () { return SQL.WhereClause.NoteContains() }
            }
        ];

        //Returns the field comparison operator that corresponds to a specific id
        SQL.WhereClause.getFieldComparisonOperatorInfo = function (ID) {
            for (var nr in SQL.WhereClause._fieldComparisonOperators) {
                var op = SQL.WhereClause._fieldComparisonOperators[nr];
                if (op.ID == ID)
                    return op;
            }
            DQX.reportError("Invalid field comparison operator id " + ID);
        }

        //Returns a list of all field operators that are compatible with an SQL column data type (as defined in SQL.DataTypes)
        SQL.WhereClause.getCompatibleFieldComparisonOperators = function (datatype) {
            var lst = [];
            for (var nr in SQL.WhereClause._fieldComparisonOperators) {
                var op = SQL.WhereClause._fieldComparisonOperators[nr];
                if (op[datatype])
                    lst.push(op);
            }
            return lst;
        }

        //A class that encapsulates the comparison of a field to a fixed value
        SQL.WhereClause.whcClassGenerator['comparefixed'] = function(args) {
            return SQL.WhereClause.CompareFixed(args.ColName,args.Tpe,args.CompValue);
        }
        SQL.WhereClause.CompareFixed = function (icolname, icomptype, ivalue) {
            var that = {};
            var fnd = false;
            for (var opnr = 0; opnr < SQL.WhereClause._fieldComparisonOperators.length; opnr++)
                if (SQL.WhereClause._fieldComparisonOperators[opnr].ID == icomptype)
                    fnd = true;
            if (!fnd)
                DQX.reportError("Invalid comparison where clause statement: " + icompoundtype);
            that.whcClass = 'comparefixed';
            that.isCompound = false;
            that.ColName = icolname;
            that.Tpe = icomptype;
            that.CompValue = ivalue;

            //Creates the associated controls in the querybuilder GUI
            that._buildStatement = function (ID, elem, querybuilder) {

                if (!querybuilder.hasColumn(this.ColName))
                    return;

                var mycol = querybuilder.getColumn(this.ColName);
                if (mycol.isMultipleCoice()) {
                    var wrapper = DocEl.Div();
                    wrapper.addStyle('display', 'inline-block');
                    wrapper.setCssClass('DQXSelectWrapper');
                    var ctrl_choices = DocEl.Select(mycol.choicelist, this.CompValue, {parent:wrapper});
                    ctrl_choices.setID(querybuilder.getControlID(ID, "Content"));
                    ctrl_choices.setWidthPx(150);
                    ctrl_choices.setCssClass('DQXQBQueryboxControl');
                    querybuilder.decorateQueryStatementControl(ctrl_choices, ID);
                    elem.addElem(wrapper);
                    return;
                }
                else {
                    var compcontent = DocEl.Edit(mycol.content2Display(this.CompValue));
                    compcontent.setID(querybuilder.getControlID(ID, "Content"));
                    compcontent.setWidthPx(140);
                    compcontent.setCssClass('DQXQBQueryboxControl');
                    querybuilder.decorateQueryStatementControl(compcontent, ID);
                    elem.addElem(compcontent);
                }
            }

            //Fetches the content of this statement from the controls in the querybuilder GUI
            that._fetchStatementContent = function (ID, querybuilder) {
                if ((this.ColName=='_subset_') || (this.ColName=='_note_')) {
                    DQX.reportError('Invalid query component content');
                }
                else {
                    var mycol = querybuilder.getColumn(this.ColName);
                    if ($("#" + querybuilder.getControlID(ID, "Content")).length > 0) {
                        this.CompValue = mycol.display2Content($("#" + querybuilder.getControlID(ID, "Content")).val());
                    }
                }
            }

            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' '+that.Tpe+' '+queryData.fieldInfoMap[that.ColName].toDisplayString(that.CompValue);
            }


            return that;
        }


        //A class that encapsulates the comparison of a field to a value range
        SQL.WhereClause.whcClassGenerator['between'] = function(args) {
            return SQL.WhereClause.CompareBetween(args.ColName, args.CompValueMin,  args.CompValueMax);
        }
        SQL.WhereClause.CompareBetween = function (icolname, ivalueMin, ivalueMax) {
            var that = {};
            that.whcClass = 'between';
            that.isCompound = false;
            that.ColName = icolname;
            that.CompValueMin = ivalueMin;
            that.CompValueMax = ivalueMax;
            that.Tpe = "between";

            //Creates the associated controls in the querybuilder GUI
            that._buildStatement = function (ID, elem, querybuilder) {

                if (!querybuilder.hasColumn(this.ColName))
                    return;

                var mycol = querybuilder.getColumn(this.ColName);

                var compcontent = DocEl.Edit(mycol.content2Display(this.CompValueMin));
                compcontent.setID(querybuilder.getControlID(ID, "ContentMin"));
                compcontent.setWidthPx(140);
                compcontent.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(compcontent, ID);
                elem.addElem(compcontent);

                elem.addElem(" and ");

                var compcontent = DocEl.Edit(mycol.content2Display(this.CompValueMax));
                compcontent.setID(querybuilder.getControlID(ID, "ContentMax"));
                compcontent.setWidthPx(140);
                compcontent.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(compcontent, ID);
                elem.addElem(compcontent);
            }

            //Fetches the content of this statement from the controls in the querybuilder GUI
            that._fetchStatementContent = function (ID, querybuilder) {
                var mycol = querybuilder.getColumn(this.ColName);
                if ($("#" + querybuilder.getControlID(ID, "ContentMin")).length > 0) {
                    this.CompValueMin = mycol.display2Content($("#" + querybuilder.getControlID(ID, "ContentMin")).val());
                }
                if ($("#" + querybuilder.getControlID(ID, "ContentMax")).length > 0) {
                    this.CompValueMax = mycol.display2Content($("#" + querybuilder.getControlID(ID, "ContentMax")).val());
                }
            }

            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' between '+queryData.fieldInfoMap[that.ColName].toDisplayString(that.CompValueMin )+' and '+queryData.fieldInfoMap[that.ColName].toDisplayString(that.CompValueMax);
            }


            return that;
        }


        //A class that Encapsulates the equality comparison of a field to another field
        SQL.WhereClause.whcClassGenerator['equalsfield'] = function(args) {
            var whc = SQL.WhereClause.EqualsField();
            whc.ColName = args.ColName;
            whc.ColName2 = args.ColName2;
            return whc;
        }
        SQL.WhereClause.EqualsField = function () {
            var that = {};
            that.whcClass = 'equalsfield';
            that.isCompound = false;
            that.ColName = "";
            that.ColName2 = "";
            that.Tpe = "=FIELD";


            //Creates the associated controls in the querybuilder GUI
            that._buildStatement = function (ID, elem, querybuilder) {

                var thecols = [];
                for (var colnr = 0; colnr < querybuilder.myColumns.length; colnr++)
                    if (querybuilder.myColumns[colnr].ID != this.ColName)
                        thecols.push({ id: querybuilder.myColumns[colnr].ID, name: querybuilder.myColumns[colnr].name });
                var wrapper = DocEl.Div();
                wrapper.addStyle('display', 'inline-block');
                wrapper.setCssClass('DQXSelectWrapper');
                var ctrl_otherfield = DocEl.Select(thecols, this.ColName2, {parent:wrapper});
                ctrl_otherfield.setID(querybuilder.getControlID(ID, "OtherField"));
                ctrl_otherfield.setWidthPx(150);
                ctrl_otherfield.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_otherfield, ID);
                elem.addElem(wrapper);
            }

            //Fetches the content of this statement from the controls in the querybuilder GUI
            that._fetchStatementContent = function (ID, querybuilder) {
                if ($("#" + querybuilder.getControlID(ID, "OtherField")).length > 0) {
                    this.ColName2 = $("#" + querybuilder.getControlID(ID, "OtherField")).val();
                }
            }

            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' = '+queryData.fieldInfoMap[that.ColName2].name;
            }


            return that;
        }



        //A class that Encapsulates the differential comparison of a field to another field
        SQL.WhereClause.whcClassGenerator['differsfield'] = function(args) {
            var whc = SQL.WhereClause.DiffersField();
            whc.ColName = args.ColName;
            whc.ColName2 = args.ColName2;
            return whc;
        }
        SQL.WhereClause.DiffersField = function () {
            var that = {};
            that.whcClass = 'differsfield';
            that.isCompound = false;
            that.ColName = "";
            that.ColName2 = "";
            that.Tpe = "<>FIELD";


            //Creates the associated controls in the querybuilder GUI
            that._buildStatement = function (ID, elem, querybuilder) {

                var thecols = [];
                for (var colnr = 0; colnr < querybuilder.myColumns.length; colnr++)
                    if (querybuilder.myColumns[colnr].ID != this.ColName)
                        thecols.push({ id: querybuilder.myColumns[colnr].ID, name: querybuilder.myColumns[colnr].name });
                var wrapper = DocEl.Div();
                wrapper.addStyle('display', 'inline-block');
                wrapper.setCssClass('DQXSelectWrapper');
                var ctrl_otherfield = DocEl.Select(thecols, this.ColName2, {parent:wrapper});
                ctrl_otherfield.setID(querybuilder.getControlID(ID, "OtherField"));
                ctrl_otherfield.setWidthPx(150);
                ctrl_otherfield.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_otherfield, ID);
                elem.addElem(wrapper);
            }

            //Fetches the content of this statement from the controls in the querybuilder GUI
            that._fetchStatementContent = function (ID, querybuilder) {
                if ($("#" + querybuilder.getControlID(ID, "OtherField")).length > 0) {
                    this.ColName2 = $("#" + querybuilder.getControlID(ID, "OtherField")).val();
                }
            }

            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' <> '+queryData.fieldInfoMap[that.ColName2].name;
            }

            return that;
        }


        //A class that Encapsulates the numerical comparison of a field to another field
        SQL.WhereClause.whcClassGenerator['comparefield'] = function(args) {
            var whc = SQL.WhereClause.CompareField(args.Tpe);
            whc.ColName = args.ColName;
            whc.ColName2 = args.ColName2;
            whc.Factor = args.Factor;
            whc.Offset = args.Offset;
            return whc;
        }
        SQL.WhereClause.CompareField = function (icomptype) {
            var that = {};
            that.whcClass = 'comparefield';
            that.isCompound = false;
            that.ColName = "";
            that.ColName2 = "";
            that.Tpe = icomptype;
            that.Factor = 1.0;
            that.Offset = 0.0;


            //Creates the associated controls in the querybuilder GUI
            that._buildStatement = function (ID, elem, querybuilder) {
                var ctrl_factor = DocEl.Edit(this.Factor);
                ctrl_factor.setID(querybuilder.getControlID(ID, "Factor"));
                ctrl_factor.setWidthPx(50);
                ctrl_factor.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_factor, ID);
                elem.addElem(ctrl_factor);

                elem.addElem(" x ");

                var thecols = [];
                for (var colnr = 0; colnr < querybuilder.myColumns.length; colnr++)
                    if (querybuilder.myColumns[colnr].isNumerical())
                        if (querybuilder.myColumns[colnr].ID != this.ColName)
                            thecols.push({ id: querybuilder.myColumns[colnr].ID, name: querybuilder.myColumns[colnr].name });
                var wrapper = DocEl.Div();
                wrapper.addStyle('display', 'inline-block');
                wrapper.setCssClass('DQXSelectWrapper');
                var ctrl_otherfield = DocEl.Select(thecols, this.ColName2, {parent:wrapper});
                ctrl_otherfield.setID(querybuilder.getControlID(ID, "OtherField"));
                ctrl_otherfield.setWidthPx(150);
                ctrl_otherfield.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_otherfield, ID);
                elem.addElem(wrapper);

                elem.addElem(" + ");

                var ctrl_offset = DocEl.Edit(this.Offset);
                ctrl_offset.setID(querybuilder.getControlID(ID, "Offset"));
                ctrl_offset.setWidthPx(50);
                ctrl_offset.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_offset, ID);
                elem.addElem(ctrl_offset);

            }

            //Fetches the content of this statement from the controls in the querybuilder GUI
            that._fetchStatementContent = function (ID, querybuilder) {
                if ($("#" + querybuilder.getControlID(ID, "Factor")).length > 0) {
                    this.Factor = $("#" + querybuilder.getControlID(ID, "Factor")).val();
                    this.Offset = $("#" + querybuilder.getControlID(ID, "Offset")).val();
                    this.ColName2 = $("#" + querybuilder.getControlID(ID, "OtherField")).val();
                }
            }


            that.toQueryDisplayString = function(queryData, level) {
                var str= queryData.fieldInfoMap[that.ColName].name+' '+that.Tpe[0]+' ';
                if (Math.abs(that.Factor-1)>1.0e-9) {
                    if (that.Factor==0)
                        var factorStr = '0';
                    else {
                        var factorVal = parseFloat(that.Factor);
                        var decimCount = Math.max(0, Math.round(4-Math.log(Math.abs(factorVal)) / Math.LN10));
                        var factorStr = factorVal.toFixed(decimCount);
                    }
                    str += factorStr+'x';
                }
                str += queryData.fieldInfoMap[that.ColName2].name;
                var offsetStr = queryData.fieldInfoMap[that.ColName].toDisplayString(Math.abs(that.Offset));
                if (that.Offset>0)
                    str += '+'+offsetStr;
                if (that.Offset<0)
                    str += '-'+offsetStr;
                return str;
            }


            return that;
        }



        //A class that checks for presence of the value
        SQL.WhereClause.whcClassGenerator['ispresent'] = function(args) {
            var whc = SQL.WhereClause.IsPresent();
            whc.ColName = args.ColName;
            return whc;
        }
        SQL.WhereClause.IsPresent = function () {
            var that = {};
            that.whcClass = 'ispresent';
            that.isCompound = false;
            that.Tpe = "ISPRESENT";
            that._buildStatement = function (ID, elem, querybuilder) {
            }
            that._fetchStatementContent = function (ID, querybuilder) {
            }
            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' is present';
            }
            return that;
        }


        //A class that checks for absence of the value
        SQL.WhereClause.whcClassGenerator['isabsent'] = function(args) {
            var whc = SQL.WhereClause.IsAbsent();
            whc.ColName = args.ColName;
            return whc;
        }
        SQL.WhereClause.IsAbsent = function () {
            var that = {};
            that.whcClass = 'isabsent';
            that.isCompound = false;
            that.Tpe = "ISABSENT";
            that._buildStatement = function (ID, elem, querybuilder) {
            }
            that._fetchStatementContent = function (ID, querybuilder) {
            }
            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' is absent';
            }
            return that;
        }


        //A class that checks for presence of a string value
        SQL.WhereClause.whcClassGenerator['isstringnonempty'] = function(args) {
            var whc = SQL.WhereClause.IsNotEmptyStr();
            whc.ColName = args.ColName;
            return whc;
        }
        SQL.WhereClause.IsNotEmptyStr = function () {
            var that = {};
            that.whcClass = 'isstringnonempty';
            that.isCompound = false;
            that.Tpe = "ISNOTEMPTYSTR";
            that._buildStatement = function (ID, elem, querybuilder) {
            }
            that._fetchStatementContent = function (ID, querybuilder) {
            }
            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' is present';
            }
            return that;
        }


        //A class that checks for absence of the value
        SQL.WhereClause.whcClassGenerator['isstringempty'] = function(args) {
            var whc = SQL.WhereClause.IsEmptyStr();
            whc.ColName = args.ColName;
            return whc;
        }
        SQL.WhereClause.IsEmptyStr = function () {
            var that = {};
            that.whcClass = 'isstringempty';
            that.isCompound = false;
            that.Tpe = "ISEMPTYSTR";
            that._buildStatement = function (ID, elem, querybuilder) {
            }
            that._fetchStatementContent = function (ID, querybuilder) {
            }
            that.toQueryDisplayString = function(queryData, level) {
                return queryData.fieldInfoMap[that.ColName].name+' is absent';
            }
            return that;
        }



        //A class that checks subset membership
        SQL.WhereClause.whcClassGenerator['_subset_'] = function(args) {
            var whc = SQL.WhereClause.InSubset();
            whc.Subset = args.Subset;
            whc.SubsetTable = args.SubsetTable;
            whc.PrimKey = args.PrimKey;
            return whc;
        }
        SQL.WhereClause.InSubset = function () {
            var that = {};
            that.whcClass = '_subset_';
            that.isCompound = false;
            that.Tpe = "_subset_";
            that.ColName = '_subset_';
            that._buildStatement = function (ID, elem, querybuilder) {
                that.SubsetTable = querybuilder.subsetTableName;
                that.PrimKey = querybuilder.primKey;
                var thesubsets = [];
                if (querybuilder.subsetList) {
                    $.each(querybuilder.subsetList, function(idx, subset) {
                        thesubsets.push({ id: subset.id, name: subset.name });
                    });
                }
                var wrapper = DocEl.Div();
                wrapper.addStyle('display', 'inline-block');
                wrapper.setCssClass('DQXSelectWrapper');
                var ctrl_subsets = DocEl.Select(thesubsets, this.Subset, {parent:wrapper});
                ctrl_subsets.setID(querybuilder.getControlID(ID, "Subset"));
                ctrl_subsets.setWidthPx(150);
                ctrl_subsets.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_subsets, ID);
                elem.addElem(wrapper);
                //Hidden elements to keep track of extra stuff
                var ctrl1 = DocEl.Span();
                ctrl1.setID(querybuilder.getControlID(ID, "STable"));
                ctrl1.addElem(that.SubsetTable);
                ctrl1.addStyle('display', 'none');
                elem.addElem(ctrl1);
                var ctrl1 = DocEl.Span();
                ctrl1.setID(querybuilder.getControlID(ID, "PrimKey"));
                ctrl1.addElem(that.PrimKey);
                ctrl1.addStyle('display', 'none');
                elem.addElem(ctrl1);

            }
            that._fetchStatementContent = function (ID, querybuilder) {
                this.Subset = $("#" + querybuilder.getControlID(ID, "Subset")).val();
                this.SubsetTable = $("#" + querybuilder.getControlID(ID, "STable")).text();
                this.PrimKey = $("#" + querybuilder.getControlID(ID, "PrimKey")).text();
            }
            that.toQueryDisplayString = function(queryData, level) {
                var subsetName = '[Unknown]';
                if (queryData.subsetMap[this.Subset])
                    subsetName = queryData.subsetMap[this.Subset].name;
                return 'in subset "'+subsetName+'"';
            }
            return that;
        }




        //A class that checks that a note contains a certain text
        SQL.WhereClause.whcClassGenerator['_note_'] = function(args) {
            var whc = SQL.WhereClause.NoteContains();
            whc.NoteText = args.NoteText;
            whc.PrimKey = args.PrimKey;
            whc.NoteItemTable = args.NoteItemTable;
            return whc;
        }
        SQL.WhereClause.NoteContains = function () {
            var that = {};
            that.whcClass = '_note_';
            that.isCompound = false;
            that.Tpe = "_note_";
            that.ColName = '_note_';
            that.NoteText = '';
            that._buildStatement = function (ID, elem, querybuilder) {
                that.PrimKey = querybuilder.primKey;
                that.NoteItemTable = querybuilder.tableName;
                var ctrl_txt = DocEl.Edit(that.NoteText);
                ctrl_txt.setID(querybuilder.getControlID(ID, "NoteText"));
                ctrl_txt.setWidthPx(150);
                ctrl_txt.setCssClass('DQXQBQueryboxControl');
                querybuilder.decorateQueryStatementControl(ctrl_txt, ID);
                elem.addElem(ctrl_txt);
                //Hidden elements to keep track of extra stuff
                var ctrl1 = DocEl.Span();
                ctrl1.setID(querybuilder.getControlID(ID, "PrimKey"));
                ctrl1.addElem(that.PrimKey);
                ctrl1.addStyle('display', 'none');
                elem.addElem(ctrl1);
                //Hidden elements to keep track of extra stuff
                var ctrl1 = DocEl.Span();
                ctrl1.setID(querybuilder.getControlID(ID, "NoteItemTable"));
                ctrl1.addElem(that.NoteItemTable);
                ctrl1.addStyle('display', 'none');
                elem.addElem(ctrl1);

            }
            that._fetchStatementContent = function (ID, querybuilder) {
                this.NoteText = $("#" + querybuilder.getControlID(ID, "NoteText")).val();
                if (!this.NoteText)
                    this.NoteText = '';
                this.PrimKey = $("#" + querybuilder.getControlID(ID, "PrimKey")).text();
                this.NoteItemTable = $("#" + querybuilder.getControlID(ID, "NoteItemTable")).text();
            }
            that.toQueryDisplayString = function(queryData, level) {
                return 'has note containing "'+this.NoteText+'"';
            }
            return that;
        }



        //A class that Encapsulates the absence of a where clause
        SQL.WhereClause.whcClassGenerator['trivial'] = function(args) {
            var whc = SQL.WhereClause.Trivial();
            return whc;
        }
        SQL.WhereClause.Trivial = function () {
            var that = {};
            that.whcClass = 'trivial';
            that.isCompound = false;
            that.Tpe = "";
            that.isTrivial = true;
            that.toQueryDisplayString = function(queryData, level) { return 'All'; }
            return that;
        }

        //A class that Encapsulates a query that should return nothing
        SQL.WhereClause.whcClassGenerator['none'] = function(args) {
            var whc = SQL.WhereClause.None();
            return whc;
        }
        SQL.WhereClause.None = function () {
            var that = {};
            that.whcClass = 'none';
            that.isCompound = false;
            that.Tpe = "None";
            that.isNone = true;
            that.toQueryDisplayString = function(queryData, level) { return 'None'; }
            return that;
        }



        //A class that Encapsulates a compound statement
        SQL.WhereClause.whcClassGenerator['compound'] = function(args) {
            var whc = SQL.WhereClause.Compound(args.Tpe,[]);
            $.each(args.Components,function(idx, comp) {
                whc.addComponent(SQL.WhereClause.whcClassGenerator[comp.whcClass](comp));
            });
            return whc;
        }
        SQL.WhereClause.Compound = function (icompoundtype, components) {
            if ((icompoundtype != 'AND') && (icompoundtype != 'OR'))
                DQX.reportError("Invalid compound where clause statement: " + icompoundtype);
            var that = {};
            that.whcClass = 'compound';
            that.isCompound = true;
            that.Tpe = icompoundtype;
            that.Components = components;
            if (that.Components == null) that.Components = [];
            that.addComponent = function (icomp) {
                this.Components.push(icomp);
            }
            that.getComponentCount = function () { return this.Components.length; }

            that.toQueryDisplayString = function(queryData, level) {
                if (!level) level = 0;
                var compstrs = [];
                $.each(that.Components,function(idx,comp) {
                    compstrs.push(comp.toQueryDisplayString(queryData, level+1));
                });
                var joinstr = ' '+that.Tpe+' ';
                if (level==0)
                    joinstr = ' <b>'+that.Tpe+'</b> ';
                var str = compstrs.join(joinstr);
                if (level==1) str = '['+str+']';
                if (level>1) str = '('+str+')';
                return str;
            }

            return that;
        }

        //A class that Encapsulates an AND statement
        SQL.WhereClause.AND = function (components) {
            return SQL.WhereClause.Compound("AND", components);
        }

        //A class that Encapsulates an OR statement
        SQL.WhereClause.OR = function (components) {
            return SQL.WhereClause.Compound("OR", components);
        }




        //Encodes a whereclause object to an url-friendly string
        SQL.WhereClause.encode = function (whc) {
            var jsonstring = JSON.stringify(whc);
            var st = Base64.encode(jsonstring);
            st = st.replace(/\+/g, "-");
            st = st.replace(/\//g, "_");
            if (Base64.decode(st)!=jsonstring) {
                var testdecoded = Base64.decode(st);
                DQX.reportError('Invalid encoding');
            }
            //st = st.replace(/=/g, "*");!!! this should be added in client& server code
            return st;
        }

        //Decodes astring encoded whereclause object and returns the whereclause
        SQL.WhereClause.decode = function (st) {
            st = Base64.decode(st);
            var tree = JSON.parse(st);
            return SQL.WhereClause.whcClassGenerator[tree.whcClass](tree);
        }


        SQL.WhereClause.clone = function(qry) {
            return SQL.WhereClause.decode(SQL.WhereClause.encode(qry));
        }

        //returns a new query that is based on an existing query, adding an extra statement
        SQL.WhereClause.createRestriction = function(origQuery0, newStatement) {
            var origQuery = SQL.WhereClause.clone(origQuery0);
            if (origQuery.isTrivial) {
                return newStatement;
            }
            //Add the statement
            if ( (origQuery.isCompound) && (origQuery.Tpe=='AND') ) {
                origQuery.addComponent(newStatement);
                return origQuery;
            }
            else {
                return SQL.WhereClause.AND([origQuery,newStatement]);
            }
        }


        //returns a new query that is based on an existing query, adding an extra fixed value statement
        SQL.WhereClause.createValueRestriction = function(origQuery0, fieldName, value, comparisonType) {
            if (!comparisonType)
                comparisonType = '=';
            var origQuery = SQL.WhereClause.clone(origQuery0);
            var newStatement = SQL.WhereClause.CompareFixed(fieldName, comparisonType, value.toString());
            if (origQuery.isTrivial) {
                return newStatement;
            }
            //try to find a matching fixed comparison statement
            var compStatement = null;
            if (origQuery.Tpe == comparisonType)
                if (origQuery.ColName == fieldName)
                    compStatement = origQuery;

            if ( (origQuery.isCompound) && (origQuery.Tpe=='AND') ) {
                $.each(origQuery.Components,function(idx,comp) {
                    if (comp.Tpe == comparisonType)
                        if (comp.ColName == fieldName)
                            compStatement = comp;
                });
            }
            if (compStatement) {//If found, adjust
                var needAdjust = true;
                if ( (comparisonType == '<') || (comparisonType == '<=') )
                    if (value < compStatement.CompValue)
                        needAdjust = false;
                if ( (comparisonType == '>') || (comparisonType == '>=') )
                    if (value > compStatement.CompValue)
                        needAdjust = false;
                compStatement.CompValue = value;
                return origQuery;
            }
            //Add the statement
            if ( (origQuery.isCompound) && (origQuery.Tpe=='AND') ) {
                origQuery.addComponent(newStatement);
                return origQuery;
            }
            else {
                return SQL.WhereClause.AND([origQuery,newStatement]);
            }
        }


        //returns a new query that is based on an existing query, adding an extra between statement to restrict a value range
        SQL.WhereClause.createRangeRestriction = function(origQuery0, fieldName, minVal, maxVal, ignorePreviousRange) {
            var origQuery = SQL.WhereClause.clone(origQuery0);
            var newStatement = SQL.WhereClause.CompareBetween(fieldName, minVal.toString(), maxVal.toString());
            if (origQuery.isTrivial) {
                return newStatement;
            }
            //try to find a matching between statement
            var betweenStatement = null;

            if (origQuery.Tpe=='between')
                if (origQuery.ColName==fieldName)
                    betweenStatement = origQuery;

            if ( (origQuery.isCompound) && (origQuery.Tpe=='AND') ) {
                $.each(origQuery.Components,function(idx,comp) {
                    if (comp.Tpe=='between')
                        if (comp.ColName==fieldName)
                            betweenStatement = comp;
                });
            }
            if (betweenStatement) {//If found, adjust
                if (ignorePreviousRange) {
                    betweenStatement.CompValueMin = minVal.toString();
                    betweenStatement.CompValueMax = maxVal.toString();
                }
                else {
                    betweenStatement.CompValueMin = (Math.max(parseFloat(betweenStatement.CompValueMin), parseFloat(minVal))).toString();
                    betweenStatement.CompValueMax = (Math.min(parseFloat(betweenStatement.CompValueMax), parseFloat(maxVal))).toString();
                }
                return origQuery;
            }
            //Add the between statement
            if ( (origQuery.isCompound) && (origQuery.Tpe=='AND') ) {
                origQuery.addComponent(newStatement);
                return origQuery;
            }
            else {
                return SQL.WhereClause.AND([origQuery,newStatement]);
            }
        }

        //////////////////////////////////////////////////////////////////////////////////////
        // Encapsulates a sql sort statement
        //////////////////////////////////////////////////////////////////////////////////////

        SQL.TableSort = function (icollist) {
            var that = {};
            that.columnList = icollist;

            that.getPrimaryColumnID = function () {
                return this.columnList[this.columnList.length - 1];
            }

            that.toString = function () {
                return this.columnList.join('~');
            }
            return that;
        }


        return SQL;
    });
