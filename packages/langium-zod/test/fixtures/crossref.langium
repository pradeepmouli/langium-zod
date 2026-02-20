grammar CrossRef

entry Model:
	variables+=Variable*
	references+=VariableRef*;

Variable:
	'var' name=ID;

VariableRef:
	'use' variable=[Variable];

terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;
