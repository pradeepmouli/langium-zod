grammar Hierarchy

entry Model:
	elements+=Feature*;

interface Element {
	name: string
}

interface Entity extends Element {
	features: Feature[]
}

interface DataType extends Element {
	typeName: string
}

type AbstractElement = Entity | DataType

Feature:
	name=ID;

terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;
