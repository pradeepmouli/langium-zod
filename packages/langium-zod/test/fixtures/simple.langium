grammar Simple

entry Model:
	items+=Greeting*;

Greeting:
	'hello' name=ID count=INT active?='active' tags+=Tag
	('desc' description=STRING)?;

Tag:
	name=ID;

fragment CommonProps:
	source=STRING;

terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"[^\"]*"/;
